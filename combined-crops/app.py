import os
import uuid
import json
import numpy as np
import random
from flask import Flask, request, render_template, jsonify, redirect, send_from_directory
from flask_cors import CORS
import pickle
import tensorflow as tf
from tensorflow import keras

# ---------------- Deterministic Setup ----------------
np.random.seed(42)
random.seed(42)
os.environ["PYTHONHASHSEED"] = "42"
tf.random.set_seed(42)
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# ---------------- Flask Setup ----------------
app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = "uploadimages"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# =====================================================
#                   MODEL 1: CROP SUGGESTION
# =====================================================
model = pickle.load(open("models/model.pkl", "rb"))
sc = pickle.load(open("models/standscaler.pkl", "rb"))
mx = pickle.load(open("models/minmaxscaler.pkl", "rb"))

crop_dict = {
    1: "Rice", 2: "Maize", 3: "Jute", 4: "Cotton", 5: "Coconut", 6: "Papaya",
    7: "Orange", 8: "Apple", 9: "Muskmelon", 10: "Watermelon", 11: "Grapes",
    12: "Mango", 13: "Banana", 14: "Pomegranate", 15: "Lentil", 16: "Blackgram",
    17: "Mungbean", 18: "Mothbeans", 19: "Pigeonpeas", 20: "Kidneybeans",
    21: "Chickpea", 22: "Coffee"
}

# =====================================================
#                   MODEL 2: YIELD PREDICTION
# =====================================================
dtr = pickle.load(open("models/dtr.pkl", "rb"))
preprocessor = pickle.load(open("models/preprocessor.pkl", "rb"))

# =====================================================
#                   MODEL 3: PLANT DISEASE
# =====================================================
MODEL_PATH = "models/plant_disease_prediction_model.h5"
IMG_SIZE = (224, 224)
CONFIDENCE_THRESHOLD = 0.6

try:
    disease_model = keras.models.load_model(MODEL_PATH)
    print("✅ Plant disease model loaded successfully!")
except Exception as e:
    print("⚠️ Failed to load plant disease model:", e)
    disease_model = None

with open("plant_disease.json", "r") as f:
    plant_disease = json.load(f)  # list of dicts

def extract_features(image_path):
    img = keras.utils.load_img(image_path, target_size=IMG_SIZE)
    arr = keras.utils.img_to_array(img)
    arr = np.expand_dims(arr, axis=0)
    arr = arr / 255.0
    return arr

def model_predict(image_path):
    if disease_model is None:
        return {"name": "❌ Model not available", "cause": "", "cure": "", "confidence": 0.0}

    img = extract_features(image_path)
    preds = disease_model.predict(img)
    index = int(np.argmax(preds))
    confidence = float(np.max(preds))

    if confidence < CONFIDENCE_THRESHOLD:
        return {"name": "Unknown / Not a plant", "cause": "", "cure": "", "confidence": confidence}

    if index < len(plant_disease):
        result = plant_disease[index]
        result["confidence"] = confidence
        return result
    else:
        return {"name": "Unknown", "cause": "", "cure": "", "confidence": confidence}

# =====================================================
#                   ROUTES
# =====================================================

# ---------- Home ----------
@app.route("/")
def home():
    return render_template("home.html")

# ---------- Crop Suggestion ----------
@app.route("/crop")
def crop_page():
    return render_template("crop.html")

@app.route("/predict_crop", methods=["POST"])
def predict_crop_html():
    N = request.form["Nitrogen"]
    P = request.form["Phosphorus"]
    K = request.form["Potassium"]
    temp = request.form["Temperature"]
    humidity = request.form["Humidity"]
    ph = request.form["pH"]
    rainfall = request.form["Rainfall"]

    feature_list = [N, P, K, temp, humidity, ph, rainfall]
    single_pred = np.array(feature_list, dtype=float).reshape(1, -1)

    mx_features = mx.transform(single_pred)
    sc_mx_features = sc.transform(mx_features)
    prediction = model.predict(sc_mx_features)

    crop = crop_dict.get(prediction[0], "Unknown")
    result = f"{crop} is the best crop to be cultivated right there."
    return render_template("crop.html", result=result)

# ---------- Yield Prediction ----------
@app.route("/yield")
def yield_page():
    return render_template("yield.html")

@app.route("/predict_yield", methods=["POST"])
def predict_yield_html():
    Year = request.form["Year"]
    rainfall = request.form["average_rain_fall_mm_per_year"]
    pesticides = request.form["pesticides_tonnes"]
    temp = request.form["avg_temp"]
    Area = request.form["Area"]
    Item = request.form["Item"]

    features = np.array([[Year, rainfall, pesticides, temp, Area, Item]], dtype=object)
    transformed_features = preprocessor.transform(features)
    prediction = dtr.predict(transformed_features).reshape(1, -1)

    return render_template("yield.html", prediction=prediction[0][0])

# ---------- Plant Disease Detection ----------
@app.route("/uploadimages/<path:filename>")
def uploaded_images(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/disease")
def disease_page():
    return render_template("disease.html")

@app.route("/upload/", methods=["POST"])
def upload_image():
    if "img" not in request.files:
        return redirect("/disease")

    image = request.files["img"]
    filename = f"temp_{uuid.uuid4().hex}_{image.filename}"
    path = os.path.join(UPLOAD_FOLDER, filename)
    image.save(path)

    prediction = model_predict(path)
    return render_template(
        "disease.html",
        result=True,
        imagepath=f"/uploadimages/{filename}",
        prediction=prediction
    )

# ---------- Weather Placeholder ----------
@app.route("/weather")
def weather_page():
    return render_template("weather.html")

# =====================================================
#                   API ROUTES
# =====================================================

@app.route("/api/predict_crop", methods=["POST"])
def predict_crop_api():
    data = request.get_json()
    try:
        feature_list = [
            data["Nitrogen"], data["Phosphorus"], data["Potassium"],
            data["Temperature"], data["Humidity"], data["pH"], data["Rainfall"]
        ]
        single_pred = np.array(feature_list, dtype=float).reshape(1, -1)
        mx_features = mx.transform(single_pred)
        sc_mx_features = sc.transform(mx_features)
        prediction = model.predict(sc_mx_features)

        crop = crop_dict.get(prediction[0], "Unknown")
        return jsonify({"prediction": crop})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/predict_yield", methods=["POST"])
def predict_yield_api():
    data = request.get_json()
    try:
        features = np.array([[
            data["Year"], data["average_rain_fall_mm_per_year"],
            data["pesticides_tonnes"], data["avg_temp"],
            data["Area"], data["Item"]
        ]], dtype=object)
        transformed_features = preprocessor.transform(features)
        prediction = dtr.predict(transformed_features).reshape(1, -1)
        return jsonify({"prediction": float(prediction[0][0])})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/predict_disease", methods=["POST"])
def predict_disease_api():
    """API endpoint for plant disease prediction that returns JSON"""
    if "img" not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    image = request.files["img"]
    if image.filename == "":
        return jsonify({"error": "No image selected"}), 400
    
    try:
        # Save image temporarily
        filename = f"temp_{uuid.uuid4().hex}_{image.filename}"
        path = os.path.join(UPLOAD_FOLDER, filename)
        image.save(path)
        
        # Get prediction
        prediction = model_predict(path)
        
        # Clean up temp file
        try:
            os.remove(path)
        except:
            pass  # File cleanup is not critical
        
        return jsonify({
            "prediction": prediction,
            "success": True
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =====================================================
#                   RUN APP
# =====================================================
if __name__ == "__main__":
    app.run(debug=True)