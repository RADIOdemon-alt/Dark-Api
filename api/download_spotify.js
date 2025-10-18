// routes/spotify.js
import express from "express"
import axios from "axios"

const router = express.Router()

// ====== دوال مساعدة ======
async function obtenerTokenSpotify() {
  const clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2"
  const clientSecret = "c2859b35c5164ff7be4f979e19224dbe"
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    { headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${encoded}` } }
  )
  return response.data.access_token
}

async function spotifyxv(query) {
  const token = await obtenerTokenSpotify()
  const response = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data.tracks.items.map((item) => ({
    title: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    album: item.album.name,
    duration: item.duration_ms,
    image: item.album.images?.[0]?.url || null,
    link: item.external_urls.spotify,
    trackId: item.id,
  }))
}

async function spotiDown(url) {
  const trackId = url.match(/track\/([a-zA-Z0-9]{22})/)?.[1]
  if (!trackId) throw new Error("لم يتم استخراج رابط صحيح من Spotify")

  const response = await axios.post(
    "https://parsevideoapi.videosolo.com/spotify-api/",
    { format: "web", url: `https://open.spotify.com/track/${trackId}` },
    { headers: { "user-agent": "Postify/1.0.0" } }
  )
  return response.data
}

// ====== GET / POST ======
async function handleRequest(query) {
  if (!query) throw new Error("query مطلوب للبحث")

  const results = await spotifyxv(query)
  if (!results.length) throw new Error("⚠️ لم يتم العثور على أي نتيجة")

  const first = results[0]
  const download = await spotiDown(first.link)

  return { track: first, download }
}

// GET ?query=
router.get("/", async (req, res) => {
  try {
    const query = req.query.query
    const data = await handleRequest(query)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// POST { "query": "اسم الأغنية" }
router.post("/", async (req, res) => {
  try {
    const query = req.body.query
    const data = await handleRequest(query)
    res.json({ status: true, ...data })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router