import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

// 🌀 دالة لتوسيع الروابط المختصرة
async function expandURL(url) {
  try {
    const response = await axios.head(url, { maxRedirects: 5 });
    return response.request.res.responseUrl || url;
  } catch (e) {
    console.warn("فشل في توسيع الرابط، سيتم استخدام الرابط الأصلي:", e.message);
    return url;
  }
}

// 🌀 دالة تحميل فيديو من TikTok
const headers = {
  authority: "ttsave.app",
  accept: "application/json, text/plain, */*",
  origin: "https://ttsave.app",
  referer: "https://ttsave.app/en",
  "user-agent": "Postify/1.0.0",
};

const ttsave = {
  submit: async function (url, referer) {
    const headerx = { ...headers, referer };
    const data = { query: url, language_id: "1" };
    return axios.post("https://ttsave.app/download", data, { headers: headerx });
  },

  parse: function ($) {
    const nickname = $("h2.font-extrabold").text();
    const username = $("a.font-extrabold.text-blue-400").text();
    const description = $("p.text-gray-600").text();

    const dlink = {
      nowm: $("a.w-full.text-white.font-bold").first().attr("href"),
      wm: $("a.w-full.text-white.font-bold").eq(1).attr("href"),
      audio: $("a[type='audio']").attr("href"),
    };

    const slides = $("a[type='slide']")
      .map((i, el) => ({ number: i + 1, url: $(el).attr("href") }))
      .get();

    return { nickname, username, description, dlink, slides };
  },

  video: async function (link) {
    try {
      const expandedLink = await expandURL(link);
      const response = await this.submit(expandedLink, "https://ttsave.app/en");
      const $ = cheerio.load(response.data);
      const result = this.parse($);

      if (result.slides && result.slides.length > 0) {
        return { type: "slide", ...result };
      }

      return {
        type: "video",
        ...result,
        videoInfo: { nowm: result.dlink.nowm, wm: result.dlink.wm },
        audioUrl: result.dlink.audio,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};

// ⚙️ GET + POST endpoint
router.all("/", async (req, res) => {
  let url = req.query.url || req.body.url;

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "📌 أرسل رابط فيديو من TikTok مثل:\n/api/tiktok?url=https://www.tiktok.com/@user/video/1234567890",
    });
  }

  try {
    const videoResult = await ttsave.video(url);
    const { type, nickname, username, description, videoInfo, slides, audioUrl } = videoResult;

    const result = {
      status: true,
      type,
      nickname: nickname || "-",
      username: username || "-",
      description: description || "-",
      slides: slides || [],
      video: videoInfo || {},
      audio: audioUrl || null,
      message: "✅ تم جلب بيانات الفيديو بنجاح",
    };

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      status: false,
      message: `⚠️ حدث خطأ أثناء التحميل: ${e.message || e}`,
    });
  }
});

export default router;
