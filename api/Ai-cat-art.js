import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const router = express.Router();

/** 🔹 ترجمة النص للإنجليزية */
async function translateToEnglish(text) {
  try {
    const url = "https://translate.googleapis.com/translate_a/single";
    const params = {
      client: "gtx",
      sl: "auto",
      tl: "en",
      dt: "t",
      q: text,
    };
    const res = await axios.get(url, { params });
    return res.data[0][0][0];
  } catch (err) {
    console.error("❌ خطأ في الترجمة:", err.message);
    return text;
  }
}

/** 🔹 توليد صورة من نص */
async function creartTxt2Img(prompt) {
  const translatedPrompt = await translateToEnglish(prompt);

  const form = new FormData();
  form.append("prompt", translatedPrompt);
  form.append("input_image_type", "text2image");
  form.append("aspect_ratio", "4x5");
  form.append("guidance_scale", "9.5");
  form.append("controlnet_conditioning_scale", "0.5");

  const response = await axios.post("https://api.creartai.com/api/v2/text2image", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data);
}

/** 🔹 توليد صورة من صورة */
async function creartImg2Img(prompt, imagePath) {
  const translatedPrompt = await translateToEnglish(prompt);

  const form = new FormData();
  form.append("prompt", translatedPrompt);
  form.append("input_image_type", "image2image");
  form.append("aspect_ratio", "4x5");
  form.append("guidance_scale", "9.5");
  form.append("controlnet_conditioning_scale", "0.5");
  form.append("image_file", fs.createReadStream(imagePath));

  const response = await axios.post("https://api.creartai.com/api/v2/image2image", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data);
}

/** 🧩 Route: /api/creart */
router.all("/", async (req, res) => {
  try {
    const prompt = req.query.prompt || req.body.prompt;
    const imageUrl = req.query.image || req.body.image;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إرسال 'prompt' (وصف الصورة) مثل: ?prompt=anime girl with red hair",
      });

    let imageBuffer;

    if (imageUrl) {
      // لو فيه صورة
      const imgPath = path.join("/tmp", `input_${Date.now()}.jpg`);
      const imgData = await axios.get(imageUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(imgPath, imgData.data);
      imageBuffer = await creartImg2Img(prompt, imgPath);
      fs.unlinkSync(imgPath);
    } else {
      // من نص فقط
      imageBuffer = await creartTxt2Img(prompt);
    }

    const base64 = imageBuffer.toString("base64");

    res.status(200).json({
      status: true,
      prompt,
      message: "✅ تم إنشاء الصورة بنجاح",
      image_base64: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل في إنشاء الصورة",
      error: err?.message || err,
    });
  }
});

export default router;