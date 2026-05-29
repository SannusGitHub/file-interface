let fileElements = [];
const directoryHistory = [];

class fileElement {
    constructor(file, classParent) {
        this.fileName = file.name;
        this.filePath = file.path;
        this.isDir = file.isdir;
        this.thumbPath = file.thumbpath || '';

        this.parentElement = classParent;
        this.element = null;

        this.init();
    };

    init() {
        const thumb = document.createElement('div');
        thumb.className = "image-container-thumb";
        thumb.setAttribute("raw", this.filePath);
        this.parentElement.appendChild(thumb);
        this.element = thumb;

        const a = document.createElement('a');
        thumb.appendChild(a);

        const img = document.createElement('img');
        // img.src = `/${this.filePath}`;
        img.src = (this.thumbPath && !this.isDir)
            ? `/${this.thumbPath}`
            : `/${this.filePath}`;

        if (this.isDir) {
            img.src = `/static/images/folder_icon.svg`;
            a.style.cursor = "pointer";

            a.addEventListener("click", () => {
                fetchList(this.filePath);
            });
        } else {
            a.style.cursor = 'pointer';
            a.addEventListener('click', (e) => {
                e.preventDefault();
                openModal({ name: this.fileName, path: this.filePath });
            });
        }

        img.onerror = function() {
            this.src = `/static/images/file_icon.svg`;
        };

        const p = document.createElement('p');
        p.innerText = this.fileName;
        thumb.appendChild(p);

        img.alt = this.fileName;
        a.appendChild(img);

        this.resize(localStorage.getItem("image_size") || "150px");
    }

    resize(newSize) {
        this.element.style.width = newSize;
        this.element.style.setProperty('--thumb-size', newSize);
    }
}

function updateBreadcrumb(directory) {
    const backBtn = document.getElementById('back-btn');
    const pathLabel = document.getElementById('breadcrumb-path');
    const dirInput = document.getElementById('uploadDirectory');

    backBtn.style.display = directoryHistory.length > 0 ? 'inline-block' : 'none';
    dirInput.value = directory || '';

    // Build clickable breadcrumb segments
    pathLabel.innerHTML = '';
    const parts = directory ? directory.split(/[\\/]/) : [];

    parts.forEach((part, index) => {
        const segmentPath = parts.slice(0, index + 1).join('/');
        const isLast = index === parts.length - 1;

        if (index > 0) {
            const sep = document.createElement('span');
            sep.textContent = '/';
            sep.className = 'breadcrumb-sep';
            pathLabel.appendChild(sep);
        }

        const span = document.createElement('span');
        span.textContent = part;

        if (isLast) {
            span.className = 'breadcrumb-current';
        } else {
            span.className = 'breadcrumb-link';
            span.addEventListener('click', () => {
                navigateTo(segmentPath);
            });
        }

        pathLabel.appendChild(span);
    });
}

function navigateTo(directory) {
    directoryHistory.push(document.getElementById('breadcrumb-path').textContent);

    fetch('/list', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirRequest: directory })
    })
        .then(response => response.json())
        .then(files => {
            const container = document.getElementById('image-containers');
            container.innerHTML = "";
            fileElements = [];

            (files || []).forEach(file => {
                fileElements.push(new fileElement(file, container));
            });

            updateBreadcrumb(directory);
        })
        .catch(err => console.error('Failed to fetch file list:', err));
}

function fetchList(directory) {
    const pathLabel = document.getElementById('breadcrumb-path');
    const currentPath = pathLabel ? pathLabel.textContent : '';
    if (currentPath !== directory) {
        directoryHistory.push(currentPath);
    }

    fetch('/list', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirRequest: directory })
    })
        .then(response => response.json())
        .then(files => {
            const container = document.getElementById('image-containers');
            container.innerHTML = "";
            fileElements = [];

            (files || []).forEach(file => {
                fileElements.push(new fileElement(file, container));
            });

            updateBreadcrumb(directory);
        })
        .catch(err => console.error('Failed to fetch file list:', err));
}

const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']);
const videoExts = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm']);
const textExts  = new Set(['.txt', '.md', '.json', '.csv', '.log', '.js', '.css', '.html', '.go', '.py']);

function getExt(filename) {
    const i = filename.lastIndexOf('.');
    return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

let targetElement = null;

function manageRightClickMenu() {
    const menu = document.getElementById('right-click-settings');

    document.addEventListener('contextmenu', function(e) {
        const thumb = e.target.closest('.image-container-thumb');
        
        if (thumb) {
            e.preventDefault();
            targetElement = thumb;
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            } else {
            menu.style.display = 'none';
        }
    });

    document.addEventListener('click', function() {
        menu.style.display = 'none';
    });

    document.getElementById('menu-delete').addEventListener('click', function() {
        if (targetElement) {
            fetch('/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetElement.getAttribute('raw') })
            })
            fetchList("filestorage");
        }
    });
}

function openModal(file) {
    const overlay   = document.getElementById('modal-overlay');
    const title     = document.getElementById('modal-title');
    const body      = document.getElementById('modal-body');
    const meta      = document.getElementById('modal-meta');
    const openLink  = document.getElementById('modal-open-link');

    const ext = getExt(file.name);
    const url = `/${file.path}`;

    title.textContent = file.name;
    body.innerHTML = '';
    meta.textContent = file.path;
    openLink.href = url;

    if (imageExts.has(ext)) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        body.appendChild(img);

    } else if (videoExts.has(ext)) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = true;
        body.appendChild(video);

    } else if (textExts.has(ext)) {
        const pre = document.createElement('pre');
        pre.textContent = 'loading...';
        body.appendChild(pre);

        fetch(url)
            .then(r => r.text())
            .then(text => { pre.textContent = text; })
            .catch(() => { pre.textContent = 'failed to load file.'; });

    } else {
        // unknown type, offer a download link
        body.innerHTML = `<span style="color:var(--text-dim);font-size:0.9em;">
            No preview available. <a href="${url}" download style="color:var(--accent);">Download file</a>
        </span>`;
    }

    // fetch metadata from backend (size etc.)
    fetch('/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path })
    })
        .then(r => r.json())
        .then(data => {
            meta.textContent = `${file.path}  ·  ${formatBytes(data.size)}`;
        })
        .catch(() => {});

    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const body    = document.getElementById('modal-body');
    overlay.classList.remove('active');
    const video = body.querySelector('video');
    if (video) video.pause();
    body.innerHTML = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

window.onload = function() {
    const toggle = document.querySelector('.dropdown-toggle');
    const dropdown = document.getElementById('uploadFormContainer');

    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            dropdown.style.display = 'none';
        }
    });

    document.getElementById('uploadForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(() => {
            const currentPath = document.getElementById('breadcrumb-path').textContent;
            const savedHistory = [...directoryHistory];
            fetchList(currentPath);

            directoryHistory.length = 0;
            savedHistory.forEach(p => directoryHistory.push(p));
            updateBreadcrumb(currentPath);
        })
        .catch(err => console.error('Upload failed:', err));
    });

    const backBtn = document.getElementById('back-btn');
    backBtn.addEventListener('click', () => {
        if (directoryHistory.length > 0) {
            const prev = directoryHistory.pop();
            directoryHistory.pop();
            navigateTo(prev);
        }
    });

    // initial load
    fetchList("filestorage");
    // clear the history entry added by the initial fetchList call
    directoryHistory.length = 0;
    updateBreadcrumb("filestorage");

    // right click menu
    manageRightClickMenu();

    // size selector
    const selectElement = document.getElementById('width-select');

    // restore saved size
    const savedSize = localStorage.getItem("image_size");
    if (savedSize) {
        selectElement.value = savedSize;
        document.getElementById('image-containers').style.setProperty('--thumb-size', savedSize);
    }

    selectElement.addEventListener('change', function() {
        const newWidth = this.value;
        // update grid column size on the container
        document.getElementById('image-containers').style.setProperty('--thumb-size', newWidth);
        fileElements.forEach(obj => obj.resize(newWidth));
        localStorage.setItem("image_size", this.value);
    });
}