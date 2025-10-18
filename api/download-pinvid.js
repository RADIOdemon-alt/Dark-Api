import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

const base = "https://www.pinterest.com";
const search = "/resource/BaseSearchResource/get/";

const headers = {
  accept: "application/json, text/javascript, */*, q=0.01",
  referer: "https://www.pinterest.com/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  "x-app-version": "a9522f",
  "x-pinterest-appstate": "active",
  "x-pinterest-pws-handler": "www/[username]/[slug].js",
  "x-requested-with": "XMLHttpRequest",
};

async function getCookies() {
  try {
    const response = await axios.get(base, { headers });
    const setHeaders = response.headers["set-cookie"];
    if (setHeaders)
      return setHeaders.map((s) => s.split(";")[0].trim()).join("; ");
    return null;
  } catch {
    return null;
  }
}

function findAllUrls(obj, acc = new Set()) {
  if (!obj) return acc;
  if (typeof obj === "string") {
    const s = obj.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) acc.add(s);
    return acc;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) findAllUrls(it, acc);
    return acc;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) findAllUrls(obj[k], acc);
  }
  return acc;
}

function looksLikePinterestHosted(u) {
  if (!u) return false;
  const l = u.toLowerCase();
  if (l.includes("pinimg") || l.includes("akamaized") || l.includes("cdn"))
    return true;
  if (l.endsWith(".mp4") || l.endsWith(".mov") || l.includes(".m3u8"))
    return true;
  return false;
}

async function searchPinterestVideos(query) {
  if (!query) return { status: false, message: "⚠️ يرجى كتابة كلمة للبحث!" };

  try {
    const cookies = await getCookies();
    if (!cookies)
      return {
        status: false,
        message: "⚠️ فشل في الحصول على الكوكيز، أعد المحاولة لاحقًا.",
      };

    const params = {
      source_url: `/search/videos/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({
        options: {
          isPrefetch: false,
          query,
          scope: "videos",
          bookmarks: [""],
          page_size: 20,
        },
        context: {},
      }),
      _: Date.now(),
    };

    const { data } = await axios.get(`${base}${search}`, {
      headers: { ...headers, cookie: cookies },
      params,
    });

    const rawResults =
      data?.resource_response?.data?.results?.filter((r) => r) || [];

    const results = rawResults.filter(
      (r) => Array.from(findAllUrls(r)).length > 0
    );
    if (results.length === 0)
      return {
        status: false,
        message: `❌ لم يتم العثور على فيديوهات لكلمة: *${query}*`,
      };

    const pins = results
      .map((result) => {
        const allUrls = Array.from(findAllUrls(result));
        const pinterestCandidates = allUrls.filter((u) =>
          looksLikePinterestHosted(u)
        );
        const externalCandidates = allUrls.filter(
          (u) => !pinterestCandidates.includes(u)
        );
        const chosenLocal = pinterestCandidates[0] || null;
        const chosenExternal = externalCandidates[0] || null;
        const id =
          result.id ||
          (result.grid_pin_data && result.grid_pin_data.id) ||
          null;
        return {
          id,
          title: result.title || result.description || "— بدون عنوان —",
          description: result.description || "— لا يوجد وصف —",
          pin_url: id ? `https://pinterest.com/pin/${id}` : "",
          video_local: chosenLocal,
          video_external: chosenExternal,
        };
      })
      .filter((p) => p.id);

    if (pins.length === 0)
      return {
        status: false,
        message: `❌ لم أجد نتائج صالحة لـ ${query}`,
      };

    return { status: true, pins };
  } catch (e) {
    return {
      status: false,
      message: "❌ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا.",
      error: e.message,
    };
  }
}

async function pindl(url) {
  try {
    const apiEndpoint =
      "https://pinterestdownloader.io/frontendService/DownloaderService";
    const { data } = await axios.post(
      apiEndpoint,
      { url },
      {
        headers: {
          "content-type": "application/json",
          origin: "https://pinterestdownloader.io",
          referer: "https://pinterestdownloader.io/",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
      }
    );
    const medias = data?.medias || [];
    const video = medias.find((m) => m.type === "video") || medias[0];
    if (!video?.url) throw new Error("لم يتم العثور على رابط فيديو صالح");
    return {
      status: true,
      title: data.title || "بدون عنوان",
      thumbnail: data.thumbnail,
      duration: data.duration || null,
      video_url: video.url,
      quality: video.quality || "غير محددة",
      medias,
    };
  } catch (e) {
    return { status: false, message: e.message };
  }
}

router.post("/", async (req, res) => {
  const { query } = req.body;
  if (!query)
    return res
      .status(400)
      .json({ status: false, message: "⚠️ يرجى إرسال query" });
  const result = await searchPinterestVideos(query);
  res.status(result.status ? 200 : 500).json(result);
});

router.get("/", async (req, res) => {
  const { query, url } = req.query;

  if (url) {
    const result = await pindl(url);
    return res.status(result.status ? 200 : 500).json(result);
  }

  if (query) {
    const result = await searchPinterestVideos(query);
    return res.status(result.status ? 200 : 500).json(result);
  }

  res.json({
    status: true,
    creator: "Radio Demon",
    message:
      "📌 استخدم GET بـ ?query= للبحث أو ?url= لتحميل الفيديو أو POST مع { query: '...' }",
  });
});

export default router;