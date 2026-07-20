const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: 'instalado' });
});

app.post('/render', (req, res) => {
  const { video_url, audio_url } = req.body;
  
  // Aquí iría la lógica de FFmpeg
  console.log('Renderizando:', { video_url, audio_url });
  
  res.json({
    status: 'success',
    message: 'Video renderizado',
    videoUrl: 'https://ejemplo.com/video.mp4'
  });
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
