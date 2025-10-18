// file: routes/codetester.js
import express from "express"
import axios from "axios"
import cheerio from "cheerio"

const router = express.Router()

async function runCode(lang, code) {
  const allowedLangs = ["c", "cpp", "go", "java", "javascript", "python", "ruby"]
  if (!allowedLangs.includes(lang)) throw new Error(`⚠️ اللغات المسموحة: ${allowedLangs.join(", ")}`)

  const runnerUrl = "https://codetester.io/runner/"
  const runUrl = "https://codetester.io/assessment/run-code"
  const checkBase = "https://codetester.io/assessment/check-submission?token="

  // 🧠 استخراج CSRF
  const page = await axios.get(runnerUrl, { headers: { "User-Agent": "Mozilla/5.0" } })
  const cookies = page.headers["set-cookie"]
    ? page.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ")
    : ""

  const $ = cheerio.load(page.data)
  const csrfToken = $('script:contains("csrfToken")')
    .html()
    ?.match(/csrfToken\s*=\s*"([^"]+)"/)?.[1]
  if (!csrfToken) throw new Error("❌ لم أستطع استخراج رمز CSRF.")

  // 🚀 إرسال الكود
  const res = await axios.post(
    runUrl,
    new URLSearchParams({
      language: lang,
      code: code,
      input: "",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": csrfToken,
        Cookie: cookies,
        Referer: runnerUrl,
        Origin: "https://codetester.io",
        "User-Agent": "Mozilla/5.0",
      },
    }
  )

  // 🧩 استخراج token
  let token = null
  if (typeof res.data === "string") {
    const match = res.data.match(/[0-9a-f-]{36}/i)
    if (match) token = match[0]
  } else if (res.data && res.data.token) token = res.data.token

  if (!token) throw new Error("❌ لم أستطع تحديد رمز التحقق (token).")

  // ⏳ انتظار النتيجة
  const checkUrl = checkBase + token
  let output = ""
  for (let i = 0; i < 10; i++) {
    const checkRes = await axios.get(checkUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookies,
      },
    })

    if (checkRes.data?.status === "done") {
      output = checkRes.data.text || ""
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  if (!output) output = "⚠️ لم تصل نتيجة التنفيذ."
  return output.replace(/^Stdout:\s*/, "").trim()
}

// 🔹 POST /api/code
router.post("/", async (req, res) => {
  try {
    const { code, lang } = req.body
    if (!code || !lang) return res.status(400).json({ status: false, message: "code و lang مطلوبان" })

    const output = await runCode(lang.toLowerCase(), code)
    res.json({ status: true, lang, output })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// 🔹 GET /api/code?code=...&lang=...
router.get("/", async (req, res) => {
  try {
    const { code, lang } = req.query
    if (!code || !lang) return res.status(400).json({ status: false, message: "code و lang مطلوبان" })

    const output = await runCode(lang.toLowerCase(), code)
    res.json({ status: true, lang, output })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router