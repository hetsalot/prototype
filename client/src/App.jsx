import { useState } from "react";
import axios from "axios";

function App() {
  // ---------- Crop Prediction ----------
  const [cropInputs, setCropInputs] = useState({
    Nitrogen: "",
    Phosphorus: "",
    Potassium: "",
    Temperature: "",
    Humidity: "",
    pH: "",
    Rainfall: "",
  });
  const [cropResult, setCropResult] = useState("");
  const [cropLoading, setCropLoading] = useState(false);

  const handleCropChange = (e) => {
    setCropInputs({ ...cropInputs, [e.target.name]: e.target.value });
  };

  const submitCrop = async () => {
    setCropLoading(true);
    setCropResult("");
    try {
      const res = await axios.post(
        "http://localhost:4000/predict-crop",
        cropInputs
      );
      setCropResult(res.data.prediction || "No result");
    } catch (err) {
      setCropResult("Error: " + err.message);
    } finally {
      setCropLoading(false);
    }
  };

  // ---------- Yield Prediction ----------
  const [yieldInputs, setYieldInputs] = useState({
    Year: "",
    average_rain_fall_mm_per_year: "",
    pesticides_tonnes: "",
    avg_temp: "",
    Area: "",
    Item: "",
  });
  const [yieldResult, setYieldResult] = useState("");
  const [yieldLoading, setYieldLoading] = useState(false);

  const handleYieldChange = (e) => {
    setYieldInputs({ ...yieldInputs, [e.target.name]: e.target.value });
  };

  const submitYield = async () => {
    setYieldLoading(true);
    setYieldResult("");
    try {
      const res = await axios.post(
        "http://localhost:4000/predict-yield",
        yieldInputs
      );
      setYieldResult(res.data.prediction || "No result");
    } catch (err) {
      setYieldResult("Error: " + err.message);
    } finally {
      setYieldLoading(false);
    }
  };

  // ---------- Plant Disease Detection ----------
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [diseaseLoading, setDiseaseLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const submitDiseaseDetection = async () => {
    if (!selectedImage) {
      alert("Please select an image first");
      return;
    }

    setDiseaseLoading(true);
    setDiseaseResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const res = await axios.post(
        "http://localhost:4000/predict-disease",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setDiseaseResult(res.data.prediction || res.data);
    } catch (err) {
      setDiseaseResult({ error: err.message });
    } finally {
      setDiseaseLoading(false);
    }
  };

  // ---------- Market Prices ----------
  const [marketInputs, setMarketInputs] = useState({
    commodity: "",
    state: "",
    district: "",
    market: "",
  });
  const [marketRecord, setMarketRecord] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketFetched, setMarketFetched] = useState(false);

  const handleMarketChange = (e) => {
    setMarketInputs({ ...marketInputs, [e.target.name]: e.target.value });
  };

  const fetchMarketPrices = async () => {
    const { commodity, state, district, market } = marketInputs;
    if (!commodity || !state || !district || !market) {
      alert("Please fill all fields");
      return;
    }

    setMarketLoading(true);
    setMarketFetched(false);
    setMarketRecord(null);

    try {
      const res = await axios.get("http://localhost:4000/market-prices", {
        params: marketInputs,
      });
      setMarketRecord(res.data.record || null);
      setMarketFetched(true);
    } catch (err) {
      setMarketRecord(null);
      setMarketFetched(true);
      alert("Error fetching prices: " + err.message);
    } finally {
      setMarketLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-8">
        Farm Prediction Dashboard
      </h1>

      {/* Crop Prediction Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Crop Prediction</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            "Nitrogen",
            "Phosphorus",
            "Potassium",
            "Temperature",
            "Humidity",
            "pH",
            "Rainfall",
          ].map((field) => (
            <input
              key={field}
              type="number"
              name={field}
              placeholder={field}
              value={cropInputs[field]}
              onChange={handleCropChange}
              className="border p-2 rounded"
            />
          ))}
        </div>
        <button
          onClick={submitCrop}
          className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          {cropLoading ? "Predicting..." : "Predict Crop"}
        </button>
        {cropResult && <p className="mt-2 font-medium">Result: {cropResult}</p>}
      </div>

      {/* Yield Prediction Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Yield Prediction</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: "Year", type: "number" },
            { name: "average_rain_fall_mm_per_year", type: "number" },
            { name: "pesticides_tonnes", type: "number" },
            { name: "avg_temp", type: "number" },
            { name: "Area", type: "text" },
            { name: "Item", type: "text" },
          ].map((field) => (
            <input
              key={field.name}
              type={field.type}
              name={field.name}
              placeholder={field.name}
              value={yieldInputs[field.name]}
              onChange={handleYieldChange}
              className="border p-2 rounded"
            />
          ))}
        </div>
        <button
          onClick={submitYield}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {yieldLoading ? "Predicting..." : "Predict Yield"}
        </button>
        {yieldResult && (
          <p className="mt-2 font-medium">Result: {yieldResult}</p>
        )}
      </div>

      {/* Plant Disease Detection Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Plant Disease Detection</h2>
        <div className="mb-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="border p-2 rounded w-full"
          />
        </div>
        {imagePreview && (
          <div className="mb-4">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full h-48 object-contain border rounded"
            />
          </div>
        )}
        <button
          onClick={submitDiseaseDetection}
          disabled={!selectedImage || diseaseLoading}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
        >
          {diseaseLoading ? "Analyzing..." : "Detect Disease"}
        </button>
        {diseaseResult && (
          <div className="mt-4 p-4 border rounded">
            {diseaseResult.error ? (
              <p className="text-red-600">Error: {diseaseResult.error}</p>
            ) : (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Disease: {diseaseResult.name}
                </h3>
                {diseaseResult.cause && (
                  <div className="mb-2">
                    <strong>Cause:</strong> {diseaseResult.cause}
                  </div>
                )}
                {diseaseResult.cure && (
                  <div>
                    <strong>Treatment:</strong> {diseaseResult.cure}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Market Prices Section */}
      <div className="bg-white shadow-md rounded-lg p-6 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Market Prices</h2>
        <div className="grid grid-cols-2 gap-4">
          {["commodity", "state", "district", "market"].map((field) => (
            <input
              key={field}
              type="text"
              name={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={marketInputs[field]}
              onChange={handleMarketChange}
              className="border p-2 rounded"
            />
          ))}
        </div>
        <button
          onClick={fetchMarketPrices}
          className="mt-4 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
        >
          {marketLoading ? "Fetching..." : "Get Price"}
        </button>

        {marketFetched && (
          <>
            {marketRecord ? (
              <div className="mt-4">
                <h3 className="font-medium">Latest Price:</h3>
                <p>
                  {marketRecord.commodity} @ {marketRecord.market},{" "}
                  {marketRecord.state} → ₹{marketRecord.price} /{" "}
                  {marketRecord.unit}
                </p>
              </div>
            ) : (
              <p className="mt-4 font-medium">No record found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
