const {
    ipcRenderer
} = require('electron');
const {
    Menu,
    dialog
} = require('@electron/remote');
const { writeFile } = require('fs/promises');
// import { ipcRenderer } from 'electron';
// import {
//     Menu,
//     dialog
// } from '@electron/remote';
// import { writeFile } from 'fs/promises';

const desktopCapturer = {
    getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
};

let recorder;
let isRecording = false;

const videoElement = document.querySelector('video');

const startButton = document.getElementById('startButton');
startButton.onclick = () => {
    if (!isRecording && typeof recorder !== 'undefined') {
        recorder.start();
        startButton.innerText = 'Recording';
        isRecording = true;
    }
};

const stopButton = document.getElementById('stopButton');
stopButton.onclick = () => {
    if (isRecording) {
        recorder.stop();
        startButton.innerText = 'Start';
        isRecording = false;
    }
};

const sourceSelectButton = document.getElementById('sourceSelectButton');
sourceSelectButton.onclick = getVideoSources;

async function getVideoSources() {
    const sources = await desktopCapturer.getSources({
        types: [
            'window',
            'screen'
        ]
    });

    const sourceOptionMenu = Menu.buildFromTemplate(sources.map(source => {
        return {
            label: source.name,
            click: () => selectSource(source)
        };
    }));

    sourceOptionMenu.popup();
}

let videoChunks = [];

async function selectSource(source) {
    sourceSelectButton.innerText = source.name;

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'desktop',
                minSampleRate: 44.1 * 1000, // 44.1 kHz
                maxSampleRate: 192 * 1000, // 192 kHz
            }
        },
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                minFrameRate: 60,
                maxFrameRate: 240
            }
        }
    });

    videoElement.srcObject = stream;
    videoElement.play();
    videoElement.muted = true;

    recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: 20 * 1000000, // 10 Mbps
        audioBitsPerSecond: 192 * 1000, // 192 Kbps
        mimeType: 'video/webm;codecs="av1.2.31H.12.0.110.09.16.09.1,opus"'
    });

    recorder.ondataavailable = handleDataAvailable;
    recorder.onstop = handleStop;
}

function handleDataAvailable(event) {
    videoChunks.push(event.data);
}

async function handleStop(event) {
    const blob = new Blob(videoChunks, {
        type: 'video/webm;codecs="av1.2.31H.12.0.110.09.16.09.1,opus"'
    });

    const buffer = Buffer.from(await blob.arrayBuffer());

    const currentTime = new Date();
    const currentTimeString = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}-${currentTime.getHours()}-${currentTime.getMinutes()}-${currentTime.getSeconds()}`;

    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: 'Save video',
        defaultPath: `screncap-${currentTimeString}.mp4`
    });

    try {
        await writeFile(filePath, buffer);
    }
    catch (error) {
        console.log(error);
    }

    videoChunks = [];
}
