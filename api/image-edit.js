import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// مساعدة: انتظار
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// دالة المعالجة (مطابقة لمنطق الـ handler)
async function generateAIImage(imageInput, prompt) {
  const visitorId = crypto.randomUUID();
  let imageUrl;

  // إذا كانت رابط مباشر
  if (typeof imageInput === "string" && /^https?:\/\//.test(imageInput)) {
    imageUrl = imageInput;
  } else {
    // imageInput متوقع Buffer
    const fileName = `${crypto.randomUUID()}.jpg`;
    const bucket = "ai-image-editor";
    const pathName = `original/${fileName}`;

    // طلب رابط موقّع للرفع
    const signed = await axios.post(
      "https://ai-image-editor.com/api/trpc/uploads.signedUploadUrl?batch=1",
      { 0: { json: { bucket, path: pathName } } },
      { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }, timeout: 30000 }
    );

    // التعامل مع صيغ مختلفة لرد الخادم
    let uploadUrl = null;
    try {
      const payload = signed?.data?.[0]?.result?.data?.json;
      // payload قد يكون رابط نصي أو كائن يحتوي على url/uploadUrl
      if (typeof payload === "string") uploadUrl = payload;
      else if (payload?.uploadUrl) uploadUrl = payload.uploadUrl;
      else if (payload?.url) uploadUrl = payload.url;
      else uploadUrl = payload; // fallback (قد يكون رابط مباشر)
    } catch (e) {
      uploadUrl = signed?.data?.[0]?.result?.data?.json || null;
    }

    if (!uploadUrl) throw new Error("❌ فشل الحصول على رابط الرفع الموقّع (signed upload URL).");

    // ارفع الصورة إلى الرابط الموقّع
    await axios.put(uploadUrl, imageInput, {
      headers: { "Content-Type": "image/jpeg" },
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    // عنوان الوصول العام للملف (مطابق لطريقة handler الأصلية)
    imageUrl = `https://files.ai-image-editor.com/${pathName}`;
  }

  // إنشاء مهمة التعديل
  const createTask = await axios.post(
    "https://ai-image-editor.com/api/trpc/ai.createNanoBananaTask?batch=1",
    {
      0: {
        json: {
          imageUrls: [imageUrl],
          prompt,
          outputFormat: "png",
          imageSize: "auto",
          nVariants: 1,
        },
      },
    },
    {
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      timeout: 30000,
    }
  );

  const taskId =
    createTask?.data?.[0]?.result?.data?.json?.data?.taskId ||
    createTask?.data?.[0]?.result?.data?.json?.taskId ||
    createTask?.data?.[0]?.result?.data?.json?.data?.taskId;

  if (!taskId) throw new Error("❌ فشل إنشاء المهمة (لم يتم استلام taskId).");

  // متابعة الحالة (polling)
  let resultUrl = null;
  const interval = 2500;
  const maxAttempts = 60; // حدود لحماية حلقة لا نهائية
  let attempts = 0;

  while (!resultUrl && attempts < maxAttempts) {
    attempts++;
    const check = await axios.get(
      `https://ai-image-editor.com/api/trpc/ai.queryNanoBananaTask?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { json: { taskId, visitorId } } })
      )}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 30000 }
    );

    const data = check?.data?.[0]?.result?.data?.json?.data;
    if (data?.state === "success" && Array.isArray(data?.resultUrls) && data.resultUrls.length) {
      resultUrl = data.resultUrls[0];
      break;
    } else if (data?.state === "failed") {
      throw new Error("❌ فشل في معالجة الصورة (حالة المهمة: failed).");
    } else {
      await sleep(interval);
    }
  }

  if (!resultUrl) throw new Error("❌ انتهاء المحاولات ولم يتم الحصول على نتيجة (timeout).");
  return resultUrl;
}

// GET — استدعاء عبر رابط مباشر: ?image=...&prompt=...
router.get("/", async (req, res) => {
  try {
    const { image, prompt } = req.query;
    if (!image || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة والوصف عبر ?image=رابط&prompt=الوصف",
      });

    // image قد يكون رابط أو بيانات أخرى؛ نمرره كما هو لأن generateAIImage يتعرف على الروابط
    const result = await generateAIImage(image, prompt);
    res.json({
      status: true,
      creator: "Dark Team",
      data: { input: image, prompt, result },
    });
  } catch (err) {
    console.error("❌", err);
    res.status(500).json({ status: false, error: err.message || String(err) });
  }
});

// POST — رفع الصورة في Form-Data (field name: image) مع حقل prompt
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!req.file || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة مع الوصف في Form-Data (image, prompt)",
      });

    // req.file.buffer يُمرر مباشرةً إلى generateAIImage
    const result = await generateAIImage(req.file.buffer, prompt);
    res.json({ status: true, creator: "Dark Team", data: { prompt, result } });
  } catch (err) {
    console.error("❌", err);
    res.status(500).json({ status: false, error: err.message || String(err) });
  }
});

export default router;
