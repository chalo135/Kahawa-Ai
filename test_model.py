import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input,decode_predictions
import numpy as np
from PIL import Image
import io

print("Loading MobileleNetV2...")
model = MobileNetV2(weights='imagenet',include_top=True)

print("Model loaded!")

print("\nLoading local image...")
image_path="flower.jpg"
img = Image.open(image_path)
print("Image loaaded!")

print("\nProcessing image...")
img=img.convert('RGB')
img=img.resize((224,224))
img_array=np.array(img,dtype=np.float32)
img_array=np.expand_dims(img_array,axis=0)
img_array = preprocess_input(img_array)

print(f"image shape: {img_array.shape}")
print(f"pixel range:{img_array.min():.2f} to{img_array.max():.2f}")
print("Preprocessing done!")

print("\nRunning prediction....")
raw_output=model.predict(img_array,verbose=0)
results = decode_predictions(raw_output,top=7)[0]

print("\n" + "=" *45)
print("best top 7")
print("="*45)
for rank,(class_id,label,confidence) in enumerate(results,1):
    percent=confidence*100
    bar="mia"*int(percent/7)
    print(f"#{rank} {label:<28} {percent:5.1f}% {bar}")
print("="*45)
print("this is good prediction")
