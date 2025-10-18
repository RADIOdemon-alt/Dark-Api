// file: routes/nsfwCheck.js
import express from 'express'
import axios from 'axios'
import multer from 'multer'
import FormData from 'form-data'

const router = express.Router()
const upload = multer()

async function nyckelCheck(buffer) {
  const form = new FormData()
  form.append('file', buffer, { filename: 'zen.jpg' })

  const res = await axios.post(
    'https://www.nyckel.com/v1/functions/o2f0jzcdyut2qxhu/invoke',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'origin': 'https://www.nyckel.com',
        'referer': 'https://www.nyckel.com/pretrained-classifiers/nsfw-identifier/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
      }
    }
  )

  const { labelName, labelId, confidence } = res.data
  return { labelName, labelId, confidence: (confidence * 100).toFixed(2) }
}

// POST /api/nsfw
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: false, message: 'Image file is required' })

    const result = await nyckelCheck(req.file.buffer)
    res.json({ status: true, result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// GET /api/nsfw?imageUrl=...
router.get('/', async (req, res) => {
  try {
    const { imageUrl } = req.query
    if (!imageUrl) return res.status(400).json({ status: false, message: 'Image URL is required' })

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data)
    const result = await nyckelCheck(buffer)
    res.json({ status: true, result })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router