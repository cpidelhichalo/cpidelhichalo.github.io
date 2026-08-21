const uploadInput = document.getElementById('upload');
const frameSelect = document.getElementById('frameSelect');
const downloadBtn = document.getElementById('download');
const downloadCountText = document.getElementById('downloadCount');
const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status');
const ctx = canvas.getContext('2d');
const zoomRange = document.getElementById('zoomRange');
const rotateRange = document.getElementById('rotateRange');
const resetBtn = document.getElementById('resetTransform');

const frameSources = {
    classic: 'images/delhi.png',
    modern: 'images/frame.png'
};

// For each frame style, provide a set of sample photos from the images folder
const sampleImages = {
    classic: [
        'images/sample.png',
        'images/sample2.png',
        'images/sample3.png'
    ],
    modern: [
        'images/sample2.png',
        'images/sample4.png'
    ]
};

let userImage = new Image();
let frameImage = new Image();
let hasPhoto = false;
let frameLoaded = false;
let frameFailed = false;

const supabaseUrl = 'https://frgvxkjswimnebxvbhqy.supabase.co';
const supabaseKey = 'sb_publishable_ZOEw1s8c8OM7AiOubhDlOg_9HzZyprZ';
const supabaseHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`
};

function setDownloadCount(count) {
    if (!downloadCountText) return;
    downloadCountText.textContent = Number.isFinite(count) && count >= 0 ? String(count) : '0';
}

async function loadDownloadCount() {
    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/download_stats?id=eq.1&select=count`,
            { headers: supabaseHeaders }
        );
        if (!response.ok) throw new Error('Unable to load download count');
        const data = await response.json();
        setDownloadCount(data[0]?.count);
    } catch (error) {
        setDownloadCount(0);
    }
}

async function recordDownload() {
    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/rpc/increment_downloads`,
            {
                method: 'POST',
                headers: {
                    ...supabaseHeaders,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (!response.ok) throw new Error('Unable to record download');
        setDownloadCount(await response.json());
    } catch (error) {
        statusText.textContent = 'Image downloaded, but the shared count could not be updated.';
    }
}

// Transform state (scale is relative to a base-fit scale)
const transform = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
};

let isPointerDown = false;
let lastPointer = { x: 0, y: 0 };
const pointers = new Map();
let initialDistance = null;
let initialAngle = null;
let initialScale = null;
let initialRotation = null;

function renderImage() {
    if (!hasPhoto || !userImage.complete) {
        canvas.style.display = 'none';
        downloadBtn.disabled = true;
        return;
    }

    // Choose canvas resolution: prefer frame native size, otherwise fall back to square export
    const defaultSize = 1200;
    const frameWidth = (frameLoaded && frameImage.naturalWidth) ? frameImage.naturalWidth : defaultSize;
    const frameHeight = (frameLoaded && frameImage.naturalHeight) ? frameImage.naturalHeight : defaultSize;

    // Set canvas to desired export resolution
    canvas.width = frameWidth;
    canvas.height = frameHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Base scale to fill the frame
    const baseScale = Math.max(canvas.width / userImage.width, canvas.height / userImage.height);
    const finalScale = baseScale * transform.scale;

    ctx.save();
    // Move origin to canvas center plus pan offsets
    ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
    ctx.rotate((transform.rotation || 0) * Math.PI / 180);
    ctx.scale(finalScale, finalScale);
    // Draw the user image centered at origin
    ctx.drawImage(userImage, -userImage.width / 2, -userImage.height / 2);
    ctx.restore();

    // Draw frame on top if available
    if (frameLoaded) {
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
    } else if (frameFailed) {
        // subtle border when frame is missing
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = Math.max(4, Math.round(canvas.width * 0.008));
        ctx.strokeRect(0.5 * ctx.lineWidth, 0.5 * ctx.lineWidth, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
    }

    canvas.style.display = 'block';
    downloadBtn.disabled = false;
    statusText.textContent = 'Your framed image is ready to download.';
}

function loadFrame(frameKey) {
    frameLoaded = false;
    frameFailed = false;
    frameImage.onload = () => {
        frameLoaded = true;
        frameFailed = false;
        renderImage();
    };
    frameImage.onerror = () => {
        frameLoaded = false;
        frameFailed = true;
        statusText.textContent = 'The selected frame could not be loaded — previewing without frame.';
        // still attempt to render the user image
        renderImage();
    };
    frameImage.src = frameSources[frameKey];
}

function renderSamples(frameKey) {
    const container = document.getElementById('sampleList');
    if (!container) return;
    container.innerHTML = '';
    const list = sampleImages[frameKey] || [];
    list.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'sample';
        img.className = 'sample-thumb';
        img.style.width = '110px';
        img.style.height = '70px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.cursor = 'pointer';
        img.style.border = '2px solid transparent';
        img.addEventListener('click', () => {
            Array.from(container.children).forEach(c => c.style.border = '2px solid transparent');
            img.style.border = '2px solid #2563eb';
            hasPhoto = true;
            resetTransforms();
            userImage.onload = renderImage;
            userImage.onerror = () => {
                statusText.textContent = 'The selected photo could not be loaded.';
            };
            userImage.src = src;
            statusText.textContent = 'Preparing your photo...';
        });
        container.appendChild(img);
    });
    if (!hasPhoto && list.length > 0) {
        const first = container.querySelector('.sample-thumb');
        if (first) first.click();
    }
}

function resetTransforms() {
    transform.x = 0;
    transform.y = 0;
    transform.scale = 1;
    transform.rotation = 0;
    if (zoomRange) zoomRange.value = '1';
    if (rotateRange) rotateRange.value = '0';
}

uploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (fileEvent) => {
        hasPhoto = true;
        resetTransforms();
        userImage.onload = renderImage;
        userImage.onerror = () => {
            statusText.textContent = 'The selected photo could not be loaded.';
        };
        userImage.src = fileEvent.target.result;
    };
    reader.readAsDataURL(file);
    statusText.textContent = 'Preparing your photo...';
});

frameSelect.addEventListener('change', (event) => {
    loadFrame(event.target.value);
    renderSamples(event.target.value);
});

// Pointer dragging for pan
canvas.addEventListener('pointerdown', (e) => {
    if (!hasPhoto) return;
    // track active pointers
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
        isPointerDown = true;
        const p = pointers.values().next().value;
        lastPointer.x = p.x;
        lastPointer.y = p.y;
    } else if (pointers.size === 2) {
        // initialize pinch/rotate
        const pts = Array.from(pointers.values());
        initialDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180 / Math.PI;
        initialScale = transform.scale;
        initialRotation = transform.rotation;
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && isPointerDown) {
        const p = pointers.values().next().value;
        const dx = p.x - lastPointer.x;
        const dy = p.y - lastPointer.y;
        transform.x += dx;
        transform.y += dy;
        lastPointer.x = p.x;
        lastPointer.y = p.y;
        renderImage();
    } else if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const currDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const currAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180 / Math.PI;
        if (initialDistance && initialScale != null) {
            const scaleFactor = currDist / initialDistance;
            transform.scale = initialScale * scaleFactor;
            if (zoomRange) zoomRange.value = String(transform.scale);
        }
        if (initialAngle != null && initialRotation != null) {
            const angleDelta = currAngle - initialAngle;
            transform.rotation = initialRotation + angleDelta;
            if (rotateRange) rotateRange.value = String(transform.rotation);
        }
        renderImage();
    }
});

['pointerup', 'pointercancel', 'pointerout', 'pointerleave'].forEach(ev => {
    canvas.addEventListener(ev, (e) => {
        // remove pointer tracking
        if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
        if (pointers.size === 0) {
            isPointerDown = false;
            initialDistance = null;
            initialAngle = null;
            initialScale = null;
            initialRotation = null;
        } else if (pointers.size === 1) {
            // switch back to single-pointer pan
            const p = pointers.values().next().value;
            lastPointer.x = p.x;
            lastPointer.y = p.y;
        }
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
});

// Wheel to zoom
canvas.addEventListener('wheel', (e) => {
    if (!hasPhoto) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.06 : 0.94;
    // Zoom around cursor: translate so cursor remains at same image point
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2 - transform.x;
    const cy = e.clientY - rect.top - rect.height / 2 - transform.y;
    transform.scale *= zoomFactor;
    // adjust pan to keep point under cursor stable
    transform.x -= cx * (zoomFactor - 1);
    transform.y -= cy * (zoomFactor - 1);
    if (zoomRange) zoomRange.value = String(transform.scale);
    renderImage();
}, { passive: false });

if (zoomRange) {
    zoomRange.addEventListener('input', (e) => {
        transform.scale = parseFloat(e.target.value) || 1;
        renderImage();
    });
}

if (rotateRange) {
    rotateRange.addEventListener('input', (e) => {
        transform.rotation = parseFloat(e.target.value) || 0;
        renderImage();
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        resetTransforms();
        renderImage();
    });
}

downloadBtn.addEventListener('click', () => {
    if (!hasPhoto) return;

    downloadBtn.disabled = true;
    canvas.toBlob((blob) => {
        downloadBtn.disabled = false;

        if (!blob) {
            statusText.textContent = 'Could not prepare the image for download.';
            return;
        }

        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'my-framed-photo.png';
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        recordDownload();

        // Some mobile browsers open the image instead of honoring download.
        window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
        statusText.textContent = 'Your framed image is ready. If it opened in a new tab, save it from there.';
    }, 'image/png');
});

loadFrame(frameSelect.value);
renderSamples(frameSelect.value);
loadDownloadCount();
