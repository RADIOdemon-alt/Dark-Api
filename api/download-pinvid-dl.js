import express from "express";
import axios from "axios";

const router = express.Router();

// 🌀 دالة تحميل فيديو من Pinterest
async function pindl(url) {
  try {
    const apiEndpoint = "https://pinterestdownloader.io/frontendService/DownloaderService";
    const params = { url };

    const { data } = await axios.get(apiEndpoint, { params });

    if (!data || !data.medias) throw "❌ رد غير صالح من الخادم.";

    return data;
  } catch (e) {
    console.error("حدث خطأ في وظيفة pindl:", e.message);
    throw "⚠️ فشل في جلب البيانات من Pinterest. حاول مرة أخرى.";
  }
}

// 📏 دالة حساب الحجم
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// ⚙️ GET + POST endpoint
router.all("/", async (req, res) => {
  const url = req.query.url || req.body.url;

  if (!url)
    return res.status(400).json({
      status: false,
      message: "📌 أرسل رابط فيديو من Pinterest مثل:\n/api/pinterest?url=https://www.pinterest.com/pin/695102523772320948",
    });

  try {
    const { medias, title } = await pindl(url);

    if (!medias || !Array.isArray(medias))
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على الوسائط." });

    const mp4 = medias.filter((v) => v.extension === "mp4");

    if (mp4.length > 0) {
      const size = formatSize(mp4[0].size);
      return res.json({
        status: true,
        title,
        quality: mp4[0].quality,
        size,
        video_url: mp4[0].url,
        message: "✅ تم جلب الفيديو بنجاح",
      });
    } else if (medias[0]) {
      return res.json({
        status: true,
        title,
        media_url: medias[0].url,
        message: "✅ تم جلب الوسائط بنجاح",
      });
    } else {
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على أي وسائط قابلة للتنزيل." });
    }
  } catch (e) {
    res.status(500).json({
      status: false,
      message: `⚠️ حدث خطأ أثناء التحميل: ${e}`,
    });
  }
});

export default router;