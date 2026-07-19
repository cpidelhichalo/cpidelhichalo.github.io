const uploadInput = document.getElementById('upload');
const frameSelect = document.getElementById('frameSelect');
const downloadBtn = document.getElementById('download');
const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status');
const ctx = canvas.getContext('2d');

const frameSources = {
    classic: 'images/frame-removebg.png',
    modern: 'images/frame.png'
};

let userImage = new Image();
let frameImage = new Image();
let hasPhoto = false;

function renderImage() {
    if (!hasPhoto || !frameImage.complete || !userImage.complete) {
        return;
    }

    const frameWidth = frameImage.naturalWidth || 1200;
    const frameHeight = frameImage.naturalHeight || 1200;

    canvas.width = frameWidth;
    canvas.height = frameHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(canvas.width / userImage.width, canvas.height / userImage.height);
    const drawWidth = userImage.width * scale;
    const drawHeight = userImage.height * scale;
    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;

    ctx.drawImage(userImage, x, y, drawWidth, drawHeight);
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

    canvas.style.display = 'block';
    downloadBtn.disabled = false;
    statusText.textContent = 'Your framed image is ready to download.';
}

function loadFrame(frameKey) {
    frameImage.onload = renderImage;
    frameImage.onerror = () => {
        statusText.textContent = 'The selected frame could not be loaded.';
    };
    frameImage.src = frameSources[frameKey];
}

uploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (fileEvent) => {
        userImage.onload = renderImage;
        userImage.onerror = () => {
            statusText.textContent = 'The selected photo could not be loaded.';
        };
        userImage.src = fileEvent.target.result;
        hasPhoto = true;
    };
    reader.readAsDataURL(file);
    statusText.textContent = 'Preparing your photo...';
});

frameSelect.addEventListener('change', (event) => {
    loadFrame(event.target.value);
});

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'my-framed-photo.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

loadFrame(frameSelect.value);