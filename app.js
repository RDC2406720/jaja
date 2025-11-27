//App principal
let stream = null; //Mediastream actual de la camara
let currentFacing = "environment"; //Camara activa user = frontal, environment = camara trasera
let mediaRecorder = null; //Instancia de mediarecorder para audio
let chunks = []; //Buffers temporales de audio grabado
let beforeInstallEvent = null; //Evento diferido para mostrar el boton de instalacion

//Accesos rapidos al DOM
const $ = (sel) => document.querySelector(sel);
const video = $("#video"); //Etiqueta video donde se muestra el stream
const canvas = $("#canvas"); //Etiqueta canvas para capturar fotos
const photos = $("#photos"); //Contenedor de fotos capturadas
const audios = $("#audios"); //Contenedor de audios grabados
const btnStartCam = $("#btnStartCam"); //Boton iniciar camara
const btnStopCam = $("#btnStopCam"); //Boton iniciar camara
const btnFlip = $("#btnFlip"); //Boton alternar camara
const btnTorch = $("#btnTorch"); //Boton linterna
const btnShot = $("#btnShot"); //Boton tomar foto
const videoDevice = $("#videoDevices"); //Etiqueta select para las camaras disponibles
const btnStartRec = $("#btnStartRec"); //Boton inciar grabacion de audio
const btnStopRec = $("#btnStopRec"); //Boton detener grabacion de audio
const recStatus = $("#recStatus"); //Indicador del estado de la grabacion
const btnInstall = $("#btnInstall"); //Boton para instalar la PWA

//Instalacion de la PWA (A2HS)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  beforeInstallEvent = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener("click", async () => {
  if (!beforeInstallEvent) return;
  beforeInstallEvent.prompt();
  await beforeInstallEvent.userChoice;
  btnInstall.hidden = true;
  beforeInstallEvent = null;
});

//Camara: listado y control
async function listVideoInputs() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    videoDevices.innerHTML = "";
    cams.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camara ${i + 1}`;
      videoDevices.appendChild(opt);
    });
  } catch (err) {
    console.warn("No se pudo enumerar dispositivos.", err);
  }
}

async function StartCam(constraints = {}) {
  if (!("mediaDevices" in navigator)) {
    alert("Este navegador no soporta el acceso a la camara/microfono");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacing, ...constraints },
      audio: false,
    });
    //Enlaza el stream al video para previsualizar
    video.srcObject = stream;

    //Habilita controles relacionados
    btnStopCam.disabled = false;
    btnShot.disabled = false;
    btnFlip.disabled = false;
    btnTorch.disabled = false;

    //Actualiza el listado de camaras disponibles
    await listVideoInputs();
  } catch (err) {
    alert("No se pudo iniciar la camara: " + err.message);
    console.error(err);
  }
}

//Función stopCam
function stopCam() {
  //Detiene todas las pistas del stream activo (libera la camara)
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  stream = null;
  video.srcObject = null;

  //Deshabilita controles de camara
  btnStopCam.disabled = true;
  btnShot.disabled = true;
  btnFlip.disabled = true;
  btnTorch.disabled = true;
}

//Botones de control de camara
btnStartCam.addEventListener("click", () => StartCam());
btnStopCam.addEventListener("click", stopCam);

btnFlip.addEventListener("click", async () => {
  //Alterna entre camara frontal y trasera y reinicia el stream
  currentFacing = currentFacing === "environment" ? "user" : "environment";
  stopCam();
  await StartCam();
});

videoDevices.addEventListener('change', async (e) => {
  //Cambia el deviceID especifico elegido en el select
  const id = e.target.value;
  stopCam();
  await StartCam({ deviceId: { exact: id } });
});

btnTorch.addEventListener('click', async () => {
    //Algunas plataformas permiten activar la linterna con la applyConstraints
    try {
        const [track] = stream ? stream.getVideoTracks() : [];
        if (!track) return;
        const cts = track.getConstraints();
        //Alterna el estado torch de forma simple con naive toggle
        const torch = !(cts.advanced && cts.advanced[0]?.torch);
        await track.applyConstraints({ advanced: [{ torch }] });
    } catch (err) {
        alert('La linterna no es compatible en este dispositivo o navegador.');
    }
});

btnShot.addEventListener("click", () => {
  //Captura un frame del video y descarga como archivo .png
  if (!stream) return;

  //Ajusta el canvas al tamaño real del video
  const t = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  canvas.width = t;
  canvas.height = h;

  //Dibuja el frame actual en el canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, t, h);

  //Exporta el contenido del canvas como BLOB y lo muestra o descarga
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);

    //Enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo_${Date.now()}.png`;
    a.textContent = 'Descargar foto';
    a.className = 'btn';

    //Miniatura
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'captura';
    img.style.width = '100%';

    //Envoltura y push a la galeria
    const wrap = document.createElement('div');
    wrap.appendChild(img);
    wrap.appendChild(a);
    photos.prepend(wrap);
  }, 'image/png');
});

//Audio con MediaRecorder
function supportsRecorder(){
  return 'MediaRecorder' in window; //Comprobacion de soporte 
}

btnStartRec.addEventListener("click", async () => {
  if (!supportsRecorder()) {
    alert('MediaRecorder no está disponible en este navegador.');
    return;
  }
  try {
    //Solicita solo audio del microfono
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    //Crea el recorder con mimetype webm 
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    chunks = [];

    //Acumula trozos o pedazos de audio cuando esten disponibles
    mediaRecorder.ondataavailable = e => {if (e.data.size > 0) 
      chunks.push(e.data);};

    //Actualiza UI al iniciar o detener
    mediaRecorder.onstart = () => {
      recStatus.textContent = 'Grabando...';};
    mediaRecorder.onstop = () => {
      recStatus.textContent = ''; 

      //Une los chunks en un blob y lo agrega a la galeria
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob); 

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = url;

      const link = document.createElement('a');
      link.href = url;
      link.download = `audio-${Date.now()}.webm`;
      link.textContent = 'Descargar audio';

      const wrap = document.createElement('div');
      wrap.appendChild(audio);
      wrap.appendChild(link);
      audios.prepend(wrap);
    };

    //Comienza a grabar y actualiza botones
    mediaRecorder.start();
    btnStartRec.disabled = true; //Evitar doble inicio
  }catch {
    alert('No se pudo iniciar el microfono: ' + err.message);
  }
});

//evento click para detener la grabacion
btnStopRec.addEventListener("click", () => {
	//detener la grabacion y liberar el microfono
	if (mediaRecorder && mediaRecorder.state !== "inactive") 
		{
      mediaRecorder.stop();
      btnStartRec.disabled = false; //Reactivar el boton de inicio	
	  btnStopRec.disabled = false; //Desactivar el boton de stop
	  //detiene la pista del stream del recorder
	  mediaRecorder.stream.getTracks().forEach(t => t.stop());
	}
});

//sincronizar el estado de los botones de grabacion
btnStartRec.addEventListener("click", () => {
	btnStartRec.disabled = true;
	btnStopRec.disabled = false;
});

//cuando la pestaña pierde el foco, detener la grabacion si esta en curso
window.addEventListener('visibilitychange', () => {
	  if (document.hidden) { stopCam(); }
});

if('serviceWorker' in navigator) {
    window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js'));
}

//Vibracion con toggle
let vibrando = false; //estado de la vibracion simulada
let vibrarInterval = null; //intervalo que repite el patron de vibracion
const btnVibrar = document.getElementById("btnVibrar");

if (btnVibrar){
    btnVibrar.addEventListener("click", () =>{
        //veriica el soporte de la api de vibracion
        if(!("vibrate" in navigator)) {
            alert("Tu dispositivo o navegador no soporta la vibracion");
            return;
        }
        if (!vibrando){
            //inicia vibracion repetida ((300ms vibra y 100ms pausa)
            vibrando = true;
            btnVibrar.textContent ="Detener vibración";
            vibrarInterval= setInterval(()=>{
                navigator.vibrate([300,100]); //patron corto 
            }, 400);
        }else{
            //detiene vibracion y limpia intervalo
            vibrando=false;
            btnVibrar.textContent="vibrar";
            clearInterval(vibrarInterval);
            navigator.vibrate(0); //apagar la vibracion inmediatamente

        }
    });
}
//tono de llamada simulado
let sonando =false;
let ringtoneAudio = new Audio("assets/old_phone_ring.mp3");
//ruta del audio
ringtoneAudio.loop = true; //reproducir un bucle para simular el audio
const btnRingtone = document.getElementById("btnRingtone");
if (btnRingtone){
    btnRingtone.addEventListener("click", () => {
        if(!sonando){
            //inicia reproduccion del tono y actualiza el texto del boton
            ringtoneAudio.play().then(() =>{
                sonando= true;
                btnRingtone.textContent="Detener tono.";

            })
            .catch(err=> alert ("No se pudo reproducir el tono" + err.message));
        } else{
            //pausa y reinicia  audio, restableciendo el boton
            ringtoneAudio.pause();
            ringtoneAudio.currentTime=0; //vuelve a reiniciar el audio desde el inicio
            sonando=false;
            btnRingtone.textContent="Reproducir tono";
        }
    });
}
