const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const http = require('http');

app.use(express.json());

// ========== FUNCIÓN PARA DESCARGAR CON FETCH ==========
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    };
    
    client.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Seguir redirección
        client.get(response.headers.location, options, (res) => {
          const file = fs.createWriteStream(outputPath);
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
        return;
      }
      
      const file = fs.createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

// ========== HEALTH ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: 'instalado' });
});

// ========== TEST DOWNLOAD ==========
app.get('/test-download', async (req, res) => {
  try {
    const testUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    const outputPath = '/tmp/test.mp3';
    await downloadFile(testUrl, outputPath);
    const stats = fs.statSync(outputPath);
    fs.unlinkSync(outputPath);
    res.json({ status: 'ok', size: stats.size });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// ========== RENDER ==========
app.post('/render', async (req, res) => {
  const { video_url, audio_url, uid } = req.body;
  
  if (!video_url || !audio_url) {
    return res.status(400).json({ status: 'error', message: 'Faltan video_url o audio_url' });
  }

  const id = uid || uuidv4().substring(0, 8);
  const tempDir = '/tmp';
  const videoPath = path.join(tempDir, `video_${id}.mp4`);
  const audioPath = path.join(tempDir, `audio_${id}.mp3`);
  const outputPath = path.join(tempDir, `output_${id}.mp4`);

  console.log(`[${id}] Iniciando renderizado...`);
  console.log(`[${id}] Video: ${video_url}`);
  console.log(`[${id}] Audio: ${audio_url}`);

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
          '-shortest'
        ])
        .save(outputPath)
        .on('start', () => console.log(`[${id}] FFmpeg iniciado`))
        .on('progress', (p) => console.log(`[${id}] Progreso: ${Math.round(p.percent || 0)}%`))
        .on('end', () => {
          console.log(`[${id}] ✅ FFmpeg terminado`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`[${id}] ❌ FFmpeg error:`, err.message);
          reject(err);
        });
    });
    
    console.log(`[${id}] ✅ Video renderizado`);
    
    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');
    
    // Limpiar archivos
    try {
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
      fs.unlinkSync(outputPath);
      console.log(`[${id}] 🧹 Archivos limpiados`);
    } catch(e) {}
    
    res.json({
      status: 'success',
      message: 'Video renderizado',
      videoUrl: `data:video/mp4;base64,${base64Video}`
    });
    
  } catch (error) {
    console.error(`[${id}] ❌ Error:`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
