// fixed_server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Setup multer for file uploads
const upload = multer({ dest: "uploads/" });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------- Gemini Market Price Helper -----------
async function fetchMarketPriceGemini({ commodity, state, district, market }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const prompt = `
You are an assistant that returns agricultural market prices in JSON.
Fetch or estimate the mandi price for:
- Commodity: ${commodity}
- State: ${state}
- District: ${district}
- Market: ${market}

Respond strictly in JSON only, no explanations, no markdown:
{
  "commodity": "string",
  "state": "string",
  "district": "string",
  "market": "string",
  "price": number,
  "unit": "string",
  "source": "string"
}
`;

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Remove any markdown ```json ... ``` if present
    text = text.replace(/```json\s*|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      parsed = { error: "Invalid response from Gemini", raw: text };
    }

    return parsed;
  } catch (err) {
    console.error("Gemini API request failed:", err.message || err);
    return { error: "Gemini request failed", raw: err.message };
  }
}

// ----------- Crop Prediction (Flask) -----------
app.post("/predict-crop", async (req, res) => {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/predict_crop",
      req.body,
      { timeout: 20000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Crop Prediction Error:", error?.message || error);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ----------- Yield Prediction (Flask) -----------
app.post("/predict-yield", async (req, res) => {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/predict_yield",
      req.body,
      { timeout: 20000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Yield Prediction Error:", error?.message || error);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ----------- Plant Disease Detection (Flask) -----------
app.post("/predict-disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No image file provided" });

    const formData = new FormData();
    formData.append("img", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(
      "http://localhost:5000/api/predict_disease",
      formData,
      {
        headers: { ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
      }
    );

    // cleanup
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      /* noop */
    }

    res.json(response.data);
  } catch (error) {
    console.error("Disease Detection Error:", error?.message || error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        /* noop */
      }
    }
    res.status(500).json({ error: error.response?.data || error.message });
  }
});



// Frontend exact match: requires all 4 params
app.get("/market-prices", async (req, res) => {
  const { commodity, state, district, market } = req.query;
  console.log("FRONTEND ROUTE - Exact match request:", req.query);

  if (!commodity || !state || !district || !market) {
    return res.status(400).json({
      error: "All 4 params required: commodity, state, district, market",
    });
  }

  try {
    const record = await fetchMarketPriceGemini({
      commodity,
      state,
      district,
      market,
    });
    res.json({ record });
  } catch (error) {
    console.error("FRONTEND API Error:", error?.message || error);
    res
      .status(500)
      .json({ error: error.message, details: error.response?.data });
  }
});

// ----------- MAIN ROUTE -----------
app.get("/", async (req, res) => {
  res.json({
    message: `Express server running on port ${PORT} ✅`,
    usage: {
      exact_match:
        "/market-prices?commodity=&state=&district=&market=",
      bulk: "/market-prices-test?commodity=&state=&district=&market=",
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
