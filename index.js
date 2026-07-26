const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

app.use(express.json());

// ========== FUNCIÓN PARA DESCARGAR ARCHIVOS CON USER-AGENT ==========
async function downloadFile(url, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,video/*;q=0.8,*/*;q=0.5',
        'Referer': 'https://www.pexels.com/'
      }
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error descargando:', error.message);
    throw error;
  }
}

// ========== ENDPOINT HEALTH ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: 'instalado' });
});

// ========== ENDPOINT RENDER ==========
app.post('/render', async (req, res) => {
  const { video_url, audio_url, uid } = req.body;
  
  if (!video_url || !audio_url) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Faltan video_url o audio_url' 
    });
  }

  const id = uid || uuidv4().substring(0, 8);
  const tempDir = '/tmp';
  const videoPath = path.join(tempDir, `video_${id}.mp4`);
  const audioPath = path.join(tempDir, `audio_${id}.mp3`);
  const outputPath = path.join(tempDir, `output_${id}.mp4`);

  console.log(`[${id}] Iniciando renderizado...`);
  console.log(`[${id}] Video URL: ${video_url}`);
  console.log(`[${id}] Audio URL: ${audio_url}`);

  try {
    console.log(`[${id}] Descargando video...`);
    await downloadFile(video_url, videoPath);
    console.log(`[${id}] ✅ Video descargado`);
    
    console.log(`[${id}] Descargando audio...`);
    await downloadFile(audio_url, audioPath);
    console.log(`[${id}] ✅ Audio descargado`);
    
    console.log(`[${id}] Renderizando con FFmpeg...`);
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-c:a aac',
          '-map 0:v:0',
          '-map 1:a:0',
          '-shortest',
          '-movflags +faststart'
        ])
        .save(outputPath)
        .on('start', (cmd) => {
          console.log(`[${id}] FFmpeg iniciado`);
        })
        .on('progress', (progress) => {
          console.log(`[${id}] Progreso: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log(`[${id}] ✅ FFmpeg terminado`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`[${id}] ❌ FFmpeg error:`, err.message);
          reject(err);
        });
    });
    
    console.log(`[${id}] ✅ Video renderizado en: ${outputPath}`);
    
    // 🔥 LEER EL VIDEO Y DEVOLVERLO COMO BASE64
    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');
    const videoSize = (videoBuffer.length / 1024 / 1024).toFixed(2);
    
    console.log(`[${id}] 📊 Tamaño del video: ${videoSize} MB`);
    
    // Limpiar archivos temporales
    try {
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
      fs.unlinkSync(outputPath);
    } catch(e) {}
    
    res.json({
      status: 'success',
      message: 'Video renderizado',
      videoUrl: `data:video/mp4;base64,${base64Video}`
    });
    
  } catch (error) {
    console.error(`[${id}] ❌ Error:`, error.message);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
