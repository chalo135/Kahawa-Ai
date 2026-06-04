"""
Kahawa Smart — Model Training Script
Coffee leaf rust detection using MobileNetV2 transfer learning
Dataset: JMuBEN (coffee___healthy / coffee___rust)
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import layers, models
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau

# ── CONFIG ──────────────────────────────────────────────────────────────────
HEALTHY_DIR = r"C:\Users\charl\Desktop\coffee___healthy"
RUST_DIR    = r"C:\Users\charl\Desktop\coffee___rust"
DATA_DIR    = r"C:\Users\charl\Desktop"          # parent of both class folders

IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS_1    = 15   # phase 1: train head only
EPOCHS_2    = 10   # phase 2: fine-tune last 30 layers of base
MODEL_OUT   = "coffee_rust_model.h5"

# ── DATA GENERATORS ─────────────────────────────────────────────────────────
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2,
    horizontal_flip=True,
    vertical_flip=True,
    rotation_range=20,
    zoom_range=0.15,
    shear_range=0.1,
    fill_mode="nearest",
)

val_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2,
)

train_gen = train_datagen.flow_from_directory(
    DATA_DIR,
    classes=["coffee___healthy", "coffee___rust"],
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="training",
    seed=42,
)

val_gen = val_datagen.flow_from_directory(
    DATA_DIR,
    classes=["coffee___healthy", "coffee___rust"],
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="validation",
    seed=42,
)

# class_indices: {'coffee___healthy': 0, 'coffee___rust': 1}
print("Class mapping:", train_gen.class_indices)
print(f"Training samples : {train_gen.samples}")
print(f"Validation samples: {val_gen.samples}")

# ── MODEL ────────────────────────────────────────────────────────────────────
base = MobileNetV2(weights="imagenet", include_top=False,
                   input_shape=(IMG_SIZE, IMG_SIZE, 3))
base.trainable = False   # freeze for phase 1

model = models.Sequential([
    base,
    layers.GlobalAveragePooling2D(),
    layers.Dropout(0.3),
    layers.Dense(128, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(1, activation="sigmoid"),   # 0=healthy, 1=rust
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
)
model.summary()

# ── PHASE 1: TRAIN HEAD ──────────────────────────────────────────────────────
print("\n=== Phase 1: Training head (base frozen) ===")
callbacks_p1 = [
    EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
    ReduceLROnPlateau(factor=0.5, patience=3, monitor="val_loss"),
]
history1 = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS_1,
    callbacks=callbacks_p1,
)

# ── PHASE 2: FINE-TUNE ───────────────────────────────────────────────────────
print("\n=== Phase 2: Fine-tuning last 30 layers of base ===")
base.trainable = True
for layer in base.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-4),   # lower LR for fine-tuning
    loss="binary_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
)

callbacks_p2 = [
    ModelCheckpoint(MODEL_OUT, save_best_only=True,
                    monitor="val_accuracy", verbose=1),
    EarlyStopping(patience=6, restore_best_weights=True, monitor="val_accuracy"),
    ReduceLROnPlateau(factor=0.5, patience=3, monitor="val_loss"),
]
history2 = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS_2,
    callbacks=callbacks_p2,
)

# ── FINAL EVAL ───────────────────────────────────────────────────────────────
val_loss, val_acc, val_auc = model.evaluate(val_gen, verbose=0)
print(f"\n{'='*45}")
print(f"Final validation accuracy : {val_acc*100:.2f}%")
print(f"Final validation AUC      : {val_auc:.4f}")
print(f"Model saved to            : {MODEL_OUT}")
print(f"{'='*45}")
