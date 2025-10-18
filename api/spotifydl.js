// routes/spotifydl.js
import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * Simple Spotify helper with token caching
 */
class SpotifyHelper {
  constructor() {
    this.clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2";
    this.clientSecret = "c2859b35c5164ff7be4f979e19224dbe";
    this.tokenUrl = "https://accounts.spotify.com/api/token";
    this.searchUrl = "https://api.spotify.com/v1/search";
    this.trackUrl = "https://api.spotify.com/v1/tracks";
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt) return this._token;

    const encoded = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await axios.post(
      this.tokenUrl,
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encoded}`,
        },
        timeout: 10000,
      }
    );

    const token = res.data.access_token;
    const expiresIn = res.data.expires_in || 3600;
    this._token = token;
    this._tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    return token;
  }

  static extractId(input) {
    if (!input) return null;
    const patterns = [
      /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      /spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      /spotify:track:([a-zA-Z0-9]{22})/,
      /^([a-zA-Z0-9]{22})$/
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return null;
  }

  async searchTrack(query) {
    if (!query) throw new Error("No query provided");
    const maybeId = SpotifyHelper.extractId(query);
    if (maybeId) return `https://open.spotify.com/track/${maybeId}`;
    const token = await this.getToken();
    const res = await axios.get(`${this.searchUrl}?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    const track = res.data.tracks?.items?.[0];
    if (!track) throw new Error("⚠️ لم يتم العثور على أي نتائج.");
    return track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  }
}

/**
 * Main downloader that uses parsevideoapi.videosolo.com as single source
 */
class ParseVideoAPI {
  constructor() {
    this.endpoint = "https://parsevideoapi.videosolo.com/spotify-api/";
    this.defaultHeaders = {
      'authority': 'parsevideoapi.videosolo.com',
      'user-agent': 'Postify/1.0.0',
      'referer': 'https://spotidown.online/',
      'origin': 'https://spotidown.online',
      'content-type': 'application/json'
    };
  }

  /**
   * Try to extract a valid download link from the service response.
   * We check multiple common fields to be resilient to API changes.
   * Returns { ok: true, download, metadata } or { ok: false, error }
   */
  async fetchMetadata(fullLink) {
    try {
      const resp = await axios.post(
        this.endpoint,
        { format: 'web', url: fullLink },
        { headers: this.defaultHeaders, timeout: 25000 }
      );

      const body = resp.data;
      if (!body) return { ok: false, error: "فشل في استلام استجابة من خدمة التحويل" };

      // explicit unsupported status
      if (body.status === "-4") return { ok: false, error: "الرابط غير مدعوم. فقط المسارات (Tracks) مسموحة" };

      // try common locations for metadata
      const metadata = body.data?.metadata || body.data || body.result || body.result?.data || null;

      if (!metadata || Object.keys(metadata).length === 0) {
        return { ok: false, error: "لم يتم العثور على معلومات عن المسار في خدمة التحويل" };
      }

      // possible fields that can contain a download URL
      const possibleDownloadFields = [
        'download', 'url', 'src', 'file', 'audio', 'download_url', 'stream', 'play_url'
      ];

      let download = null;
      for (const f of possibleDownloadFields) {
        if (metadata[f]) {
          download = metadata[f];
          break;
        }
      }

      // sometimes metadata.download can be an object or array, handle simple cases
      if (!download && metadata.downloads) {
        if (Array.isArray(metadata.downloads) && metadata.downloads.length > 0) download = metadata.downloads[0].url || metadata.downloads[0];
        else if (typeof metadata.downloads === 'object') download = metadata.downloads.url || metadata.downloads[0];
      }

      // if download is a nested object with links
      if (download && typeof download === 'object') {
        // try common object shapes
        download = download.url || download.link || download.src || download[0] || null;
      }

      if (!download) {
        // as last resort, check top-level body for direct urls
        const topLevelCandidates = [body.download, body.url, body.data?.url, body.result?.download];
        for (const cand of topLevelCandidates) {
          if (cand) {
            download = cand;
            break;
          }
        }
      }

      if (!download) {
        return { ok: false, error: "الخدمة لم تُعد رابط تحميل مباشر" };
      }

      // Normalize: in some responses download may be an array of mirrors
      if (Array.isArray(download) && download.length > 0) download = download[0];

      return {
        ok: true,
        download: String(download),
        metadata: {
          title: metadata.name || metadata.title || body.title || null,
          artist: metadata.artist || null,
          album: metadata.album || null,
          duration: metadata.duration || null,
          image: metadata.image || metadata.thumbnail || null,
          raw: metadata
        }
      };
    } catch (err) {
      console.error("parsevideoapi error:", err?.response?.data || err?.message || err);
      return { ok: false, error: "❗ فشل في استخراج رابط التحميل من الخدمة الخارجية" };
    }
  }

  /**
   * Stream given download URL to the express response.
   * Handles when the download URL already points to an audio stream.
   */
  async streamToClient(downloadUrl, res, filenameHint = null) {
    try {
      const audioResp = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Node.js)'
        }
      });

      // set headers
      const contentType = audioResp.headers['content-type'] || 'application/octet-stream';
      const dispositionName = filenameHint ? filenameHint.replace(/[\/\\?%*:|"<>]/g, '-') : 'track.mp3';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${dispositionName}"`);
      if (audioResp.headers['content-length']) {
        res.setHeader('Content-Length', audioResp.headers['content-length']);
      }

      // pipe stream
      audioResp.data.pipe(res);

      audioResp.data.on('error', err => {
        console.error('Stream error:', err);
        try { if (!res.headersSent) res.status(500).json({ success: false, message: '❗ خطأ أثناء تحميل الملف الصوتي' }); else res.end(); } catch (_) {}
      });
    } catch (err) {
      console.error("Error fetching audio stream:", err?.message || err);
      if (!res.headersSent) res.status(502).json({ success: false, message: '❗ فشل في تحميل الملف الصوتي من رابط التحميل' });
      else res.end();
    }
  }
}

/**
 * GET /            -> stream audio directly from download (expects ?url=...)
 * POST /           -> same as GET but accepts JSON body { url: '...' }
 * GET /info        -> returns metadata + download link (no streaming)
 */

/** helper to get url from query or body */
function resolveUrlFromReq(req) {
  // prefer body.url (POST), then query.url
  const urlFromBody = req.body?.url || req.body?.query || null;
  const urlFromQuery = req.query?.url || req.query?.query || null;
  return urlFromBody || urlFromQuery || null;
}

/** Stream endpoint */
router.get("/", async (req, res) => {
  try {
    const input = resolveUrlFromReq(req);
    if (!input) {
      return res.status(400).json({ success: false, message: "⚠️ أرسل باراميتر url. مثال: ?url=https://open.spotify.com/track/ID" });
    }

    const spotify = new SpotifyHelper();
    // allow text queries (search) or direct spotify link/id
    let fullLink;
    try {
      fullLink = (input.includes("spotify.com/track") || SpotifyHelper.extractId(input))
        ? input.trim()
        : await spotify.searchTrack(input);
    } catch (err) {
      // search failed -> assume input was direct url but keep using it
      fullLink = input.trim();
    }

    const parser = new ParseVideoAPI();
    const metaRes = await parser.fetchMetadata(fullLink);

    if (!metaRes.ok) {
      return res.status(502).json({ success: false, message: metaRes.error || '❗ فشل في استخراج رابط التحميل من الخدمة الخارجية' });
    }

    // if parse service returned a download link, stream it
    const downloadUrl = metaRes.download;
    const title = metaRes.metadata.title || 'track';
    const artist = metaRes.metadata.artist || 'artist';
    const filename = `${artist} - ${title}.mp3`.replace(/[\/\\?%*:|"<>]/g, '-');

    // stream to client
    return parser.streamToClient(downloadUrl, res, filename);

  } catch (err) {
    console.error("spotifydl / streaming error:", err?.message || err);
    if (!res.headersSent) res.status(500).json({ success: false, message: "❗ خطأ داخلي في السيرفر" });
    else res.end();
  }
});

/** allow POST to stream as well (reads body.url) */
router.post("/", async (req, res) => {
  // reuse same logic as GET
  // create a fake req object that merges body into query resolution
  req.query = req.query || {};
  try {
    // call the same handler by delegating to GET logic
    return router.handle(req, res);
  } catch (err) {
    console.error("spotifydl POST delegation error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, message: "❗ خطأ داخلي في السيرفر" });
  }
});

/** Info endpoint: returns metadata + download link (no streaming) */
router.get("/info", async (req, res) => {
  try {
    const input = resolveUrlFromReq(req);
    if (!input) return res.status(400).json({ success: false, message: "اكتب ?url=" });

    const spotify = new SpotifyHelper();
    let fullLink;
    try {
      fullLink = (input.includes("spotify.com/track") || SpotifyHelper.extractId(input))
        ? input.trim()
        : await spotify.searchTrack(input);
    } catch (err) {
      fullLink = input.trim();
    }

    const parser = new ParseVideoAPI();
    const metaRes = await parser.fetchMetadata(fullLink);

    if (!metaRes.ok) {
      return res.status(502).json({ success: false, message: metaRes.error || '❗ فشل في استخراج رابط التحميل من الخدمة الخارجية' });
    }

    const md = metaRes.metadata;
    res.json({
      success: true,
      data: {
        title: md.title || null,
        artist: md.artist || null,
        album: md.album || null,
        duration: md.duration || null,
        image: md.image || null,
        download: metaRes.download,
        raw: md.raw || null
      }
    });
  } catch (err) {
    console.error("spotifydl/info error:", err);
    res.status(500).json({ success: false, message: "خطأ داخلي" });
  }
});

export default router;