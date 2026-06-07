const optionNames = ["마이크", "AUX", "기본비트", "에코", "베이스", "기계음", "DISK UI", "피아노"];
const optionKeys = ["mic", "aux", "beat", "echo", "bass", "robot", "disk", "piano"];
const sourceNames = [
  "G1-1",
  "G1-2",
  "G1-3",
  "G1-4",
  "G2-1",
  "G2-2",
  "G2-3",
  "G2-4",
  "G3-1",
  "G3-2",
  "G3-3",
  "G3-4"
];
const optionGrid = document.querySelector("#optionGrid");
const sourceGrid = document.querySelector("#sourceGrid");
const groupPanels = document.querySelectorAll(".group-panel");
const optionTemplate = document.querySelector("#optionButtonTemplate");
const sourceTemplate = document.querySelector("#sourceButtonTemplate");
const sourceDim = document.querySelector("#sourceDim");
const sourcePopup = document.querySelector("#sourcePopup");
const sourcePopupTitle = document.querySelector("#sourcePopupTitle");
const sourcePopupVolume = document.querySelector("#sourcePopupVolume");
const sourcePopupInterval = document.querySelector("#sourcePopupInterval");
const sourcePopupVolumeMeter = document.querySelector("#sourcePopupVolumeMeter");
const sourceFileInput = document.querySelector("#sourceFileInput");
const trackTemplate = document.querySelector("#trackTemplate");
const tracksEl = document.querySelector("#tracks");
const micStatus = document.querySelector("#micStatus");
const hint = document.querySelector("#hint");
const loopCountEl = document.querySelector("#loopCount");
const mixTimerEl = document.querySelector("#mixTimer");
const playPauseBtn = document.querySelector("#playPauseBtn");
const playPauseIcon = document.querySelector("#playPauseIcon");
const clearBtn = document.querySelector("#clearBtn");
const masterMenu = document.querySelector("#masterMenu");
const masterTrack = document.querySelector(".master-track");
const masterBar = document.querySelector(".master-bar");
const masterBtn = document.querySelector(".master-btn");
const masterValue = document.querySelector("#masterValue");
const mixRecBtn = document.querySelector("#mixRecBtn");
const canvas = document.querySelector("#scope");
const canvasCtx = canvas.getContext("2d");
const diskArt = document.querySelector(".disk-art");
const kumaDiskArt = document.querySelector(".kuma-disk-art");
const diskReactor = document.querySelector(".disk-reactor");
const progressBar = document.querySelector(".progress-bar");
const stage = document.querySelector(".stage");
const pianoPanel = document.querySelector("#pianoPanel");
const pianoKeys = document.querySelector("#pianoKeys");
const pianoVolume = document.querySelector("#pianoVolume");
const pianoVolumeTrack = document.querySelector("#pianoVolumeTrack");
const pianoVolumeValue = document.querySelector("#pianoVolumeValue");
const AudioEngine = window.AudioContext || window.webkitAudioContext;

let audioCtx;
let inputStream;
let mixDestination;
let analyser;
let masterGain;
let pianoGain;
let mediaRecorder;
let activePad = null;
let mixRecorder = null;
let mixChunks = [];
let mixStartedAt = 0;
let timerId = 0;
let isPlaying = true;
let tracks = Array(sourceNames.length).fill(null);
let pausedAt = 0;
let playbackStartedAt = 0;
let loopDuration = 0;
let copiedTrack = null;
let loadingSlotIndex = null;
let beatSlotIndex = null;
let diskDrag = null;
let diskHoldTimer = 0;
let diskRotation = 0;
let masterDrag = null;
let masterVolume = 1;
let pianoVolumeLevel = 1;
let pianoVolumeDrag = null;
let waveLevel = 0;
const activePianoNotes = new Map();
const sourceIntervals = Array(sourceNames.length).fill(1);
const groupStopped = [false, false, false];
const groupNames = ["리듬소스그룹", "화음소스그룹", "릭소스그룹"];
const volumeDrag = {
  slotIndex: null,
  startY: 0,
  startGain: 1,
  maxOffset: 18
};
const sourceLongPress = {
  timer: 0,
  index: null,
  opened: false
};
const optionStates = [false, false, false, false, false, false, false, false];
const optionIndexByKey = Object.fromEntries(optionKeys.map((key, index) => [key, index]));
const pressedButtons = new WeakSet();
const pianoWhiteNotes = [
  { note: "C4", midi: 60 },
  { note: "D4", midi: 62 },
  { note: "E4", midi: 64 },
  { note: "F4", midi: 65 },
  { note: "G4", midi: 67 },
  { note: "A4", midi: 69 },
  { note: "B4", midi: 71 },
  { note: "C5", midi: 72 },
  { note: "D5", midi: 74 },
  { note: "E5", midi: 76 },
  { note: "F5", midi: 77 },
  { note: "G5", midi: 79 },
  { note: "A5", midi: 81 },
  { note: "B5", midi: 83 }
];
const pianoBlackNotes = [
  { note: "C#4", midi: 61, afterWhite: 0 },
  { note: "D#4", midi: 63, afterWhite: 1 },
  { note: "F#4", midi: 66, afterWhite: 3 },
  { note: "G#4", midi: 68, afterWhite: 4 },
  { note: "A#4", midi: 70, afterWhite: 5 },
  { note: "C#5", midi: 73, afterWhite: 7 },
  { note: "D#5", midi: 75, afterWhite: 8 },
  { note: "F#5", midi: 78, afterWhite: 10 },
  { note: "G#5", midi: 80, afterWhite: 11 },
  { note: "A#5", midi: 82, afterWhite: 12 }
];

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function setStatus(text, tone = "ready") {
  micStatus.textContent = text;
  micStatus.dataset.tone = tone;
}

function getLoopPosition() {
  if (!loopDuration) return 0;
  if (!isPlaying) return pausedAt % loopDuration;
  return (audioCtx.currentTime - playbackStartedAt) % loopDuration;
}

function getTrackPosition(track) {
  if (!track?.buffer?.duration) return 0;
  if (!track.isPlaying || !track.source) return track.pausedAt % track.buffer.duration;
  return (audioCtx.currentTime - track.startedAt) % track.buffer.duration;
}

function refreshLoopDuration() {
  loopDuration = tracks.filter(Boolean).reduce((max, track) => Math.max(max, track.buffer.duration), 0);
  if (loopDuration && pausedAt >= loopDuration) {
    pausedAt %= loopDuration;
  }
}

function updateProgressUi() {
  mixTimerEl.textContent = loopDuration ? formatTime(getLoopPosition()) : "00:00";

  tracks.forEach((track, index) => {
    const slot = sourceGrid.children[index];
    if (!slot) return;
    const sourceProgress = track?.buffer?.duration ? getTrackPosition(track) / track.buffer.duration : 0;
    slot.style.setProperty("--progress", sourceProgress.toFixed(3));
    slot.style.setProperty("--progress-angle", `${Math.round(sourceProgress * 360)}deg`);
    slot.style.setProperty("--progress-offset", (100 - sourceProgress * 100).toFixed(2));
    if (track) {
      slot.querySelector(".source-time").textContent = formatTime(getTrackPosition(track));
    }
  });
}

function updateRecProgress() {
  if (mixRecorder?.state !== "recording") {
    progressBar.style.width = "0.8%";
    stage.classList.remove("mix-recording");
    return;
  }

  const elapsed = (Date.now() - mixStartedAt) / 1000;
  const cycleProgress = (elapsed % 60) / 60;
  const progressSpan =
    Number(getComputedStyle(stage).getPropertyValue("--rec-progress-span")) || 87.8906;
  progressBar.style.width = `${Math.max(0.8, cycleProgress * progressSpan)}%`;
  stage.classList.add("mix-recording");
}

async function ensureAudio() {
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    throw new Error("Microphone requires HTTPS on mobile.");
  }

  if (!AudioEngine || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error("Audio recording is not supported in this browser.");
  }

  await ensureEngine();

  if (!isOptionOn("mic")) {
    throw new Error("Microphone option is off.");
  }

  if (!inputStream) {
    inputStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    setStatus("Mic on");
  }
}

async function ensureEngine(resume = true) {
  if (!AudioEngine) {
    throw new Error("Audio playback is not supported in this browser.");
  }

  if (!audioCtx) {
    audioCtx = new AudioEngine();
    mixDestination = audioCtx.createMediaStreamDestination();
    analyser = audioCtx.createAnalyser();
    masterGain = audioCtx.createGain();
    pianoGain = audioCtx.createGain();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    masterGain.gain.value = masterVolume;
    pianoGain.gain.value = pianoVolumeLevel;
    pianoGain.connect(masterGain);
    masterGain.connect(analyser);
    masterGain.connect(mixDestination);
    analyser.connect(audioCtx.destination);
    drawScope();
  }

  if (resume && audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

function stopMicInput() {
  if (!inputStream) return;
  inputStream.getTracks().forEach((track) => track.stop());
  inputStream = null;
  setStatus("Mic off");
}

function connectTrack(track) {
  if (masterGain) {
    track.gainNode.connect(masterGain);
    return;
  }

  track.gainNode.connect(analyser);
  track.gainNode.connect(mixDestination);
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function connectPianoNode(node) {
  if (pianoGain) {
    node.connect(pianoGain);
    return;
  }

  if (masterGain) {
    node.connect(masterGain);
    return;
  }

  node.connect(analyser);
  node.connect(mixDestination);
}

async function startPianoNote(pointerId, midi, button) {
  if (!isOptionOn("piano") || activePianoNotes.has(pointerId)) return;
  await ensureEngine();

  const now = audioCtx.currentTime;
  const frequency = midiToFrequency(midi);
  const primary = audioCtx.createOscillator();
  const overtone = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const noteGain = audioCtx.createGain();
  const overtoneGain = audioCtx.createGain();

  primary.type = "triangle";
  primary.frequency.setValueAtTime(frequency, now);
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(frequency * 2.01, now);
  overtoneGain.gain.setValueAtTime(0.18, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(0.75, now);
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(0.34, now + 0.018);
  noteGain.gain.exponentialRampToValueAtTime(0.22, now + 0.16);

  primary.connect(filter);
  overtone.connect(overtoneGain);
  overtoneGain.connect(filter);
  filter.connect(noteGain);
  connectPianoNode(noteGain);
  primary.start(now);
  overtone.start(now);
  button.classList.add("active");
  activePianoNotes.set(pointerId, {
    primary,
    overtone,
    filter,
    noteGain,
    overtoneGain,
    button
  });
  setStatus(`Key ${button.dataset.note}`);
}

function stopPianoNote(pointerId) {
  const note = activePianoNotes.get(pointerId);
  if (!note || !audioCtx) return;

  const now = audioCtx.currentTime;
  note.noteGain.gain.cancelScheduledValues(now);
  note.noteGain.gain.setTargetAtTime(0.0001, now, 0.045);
  note.button.classList.remove("active");
  setTimeout(() => {
    [note.primary, note.overtone].forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Oscillator may already be stopped after a fast pointer cancel.
      }
    });
    [note.primary, note.overtone, note.filter, note.noteGain, note.overtoneGain].forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Disconnected nodes can throw in some WebAudio implementations.
      }
    });
  }, 140);
  activePianoNotes.delete(pointerId);
}

function stopAllPianoNotes() {
  [...activePianoNotes.keys()].forEach(stopPianoNote);
}

function startTrack(track) {
  if (!isPlaying || !track.isPlaying || track.source) return;
  const source = audioCtx.createBufferSource();
  source.buffer = track.buffer;
  source.loop = true;
  source.connect(track.gainNode);
  const offset = track.buffer.duration ? track.pausedAt % track.buffer.duration : 0;
  source.start(0, offset);
  track.startedAt = audioCtx.currentTime - offset;
  track.source = source;
}

function stopTrack(track, preservePosition = false) {
  if (!track.source) return;
  if (preservePosition) {
    track.pausedAt = getTrackPosition(track);
  }
  track.source.stop();
  track.source.disconnect();
  track.source = null;
}

function makeBassPitchBuffer(sourceBuffer) {
  const pitchRatio = 0.72;
  const channelCount = sourceBuffer.numberOfChannels;
  const sampleRate = sourceBuffer.sampleRate;
  const targetLength = Math.max(1, Math.floor(sourceBuffer.length / pitchRatio));
  const bassBuffer = audioCtx.createBuffer(channelCount, targetLength, sampleRate);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const targetData = bassBuffer.getChannelData(channel);
    let previous = 0;

    for (let index = 0; index < targetLength; index += 1) {
      const sourcePosition = index * pitchRatio;
      const lowerIndex = Math.floor(sourcePosition);
      const upperIndex = Math.min(sourceData.length - 1, lowerIndex + 1);
      const blend = sourcePosition - lowerIndex;
      const sample =
        sourceData[lowerIndex] * (1 - blend) + sourceData[upperIndex] * blend;
      const lowPassed = previous * 0.42 + sample * 0.58;
      const warmed = lowPassed * 1.08;
      targetData[index] = warmed / (1 + Math.abs(warmed) * 0.18);
      previous = lowPassed;
    }
  }

  return bassBuffer;
}

function makeRobotBuffer(sourceBuffer) {
  const channelCount = sourceBuffer.numberOfChannels;
  const sampleRate = sourceBuffer.sampleRate;
  const robotBuffer = audioCtx.createBuffer(channelCount, sourceBuffer.length, sampleRate);
  const holdSamples = Math.max(1, Math.floor(sampleRate / 2400));
  const ringRate = 42;
  const bitSteps = 28;

  for (let channel = 0; channel < channelCount; channel += 1) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const targetData = robotBuffer.getChannelData(channel);
    let heldSample = 0;

    for (let index = 0; index < sourceData.length; index += 1) {
      if (index % holdSamples === 0) {
        heldSample = sourceData[index];
      }
      const time = index / sampleRate;
      const ring = 0.62 + Math.sin(2 * Math.PI * ringRate * time) * 0.38;
      const crushed = Math.round(heldSample * bitSteps) / bitSteps;
      const sample = crushed * ring;
      targetData[index] = sample / (1 + Math.abs(sample) * 0.2);
    }
  }

  return robotBuffer;
}

function createProcessedRecorderStream() {
  const echoOn = isOptionOn("echo");
  const bassOn = isOptionOn("bass");
  if ((!echoOn && !bassOn) || !inputStream || !audioCtx) {
    return { stream: inputStream, cleanup: () => {} };
  }

  const source = audioCtx.createMediaStreamSource(inputStream);
  const dry = audioCtx.createGain();
  const destination = audioCtx.createMediaStreamDestination();
  let mainOut = source;
  const nodes = [source, dry];

  if (bassOn) {
    const lowShelf = audioCtx.createBiquadFilter();
    const midCut = audioCtx.createBiquadFilter();
    const bassDrive = audioCtx.createGain();

    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 150;
    lowShelf.gain.value = 13;
    midCut.type = "peaking";
    midCut.frequency.value = 520;
    midCut.Q.value = 0.9;
    midCut.gain.value = -4;
    bassDrive.gain.value = 1.12;

    mainOut.connect(lowShelf);
    lowShelf.connect(midCut);
    midCut.connect(bassDrive);
    mainOut = bassDrive;
    nodes.push(lowShelf, midCut, bassDrive);
  }

  dry.gain.value = echoOn ? 0.86 : 1;
  mainOut.connect(dry);
  dry.connect(destination);

  if (echoOn) {
    const delay = audioCtx.createDelay(1);
    const feedback = audioCtx.createGain();
    const wet = audioCtx.createGain();

    delay.delayTime.value = 0.24;
    feedback.gain.value = 0.34;
    wet.gain.value = 0.46;

    mainOut.connect(delay);
    delay.connect(wet);
    wet.connect(destination);
    delay.connect(feedback);
    feedback.connect(delay);
    nodes.push(delay, feedback, wet);
  }

  const cleanup = () => {
    nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Some browsers throw if a node is already disconnected.
      }
    });
  };

  return { stream: destination.stream, cleanup };
}

function restartLoops() {
  if (!audioCtx) return;
  playbackStartedAt = audioCtx.currentTime - pausedAt;
  tracks.filter(Boolean).forEach((track) => {
    stopTrack(track);
    if (track.isPlaying) startTrack(track);
  });
}

function renderTracks() {
  tracksEl.innerHTML = "";
  const trackCount = tracks.filter(Boolean).length;
  stage.classList.toggle("has-loops", trackCount > 0);
  if (trackCount === 0) {
    waveLevel = 0;
    stage.style.setProperty("--wave", "0");
    diskReactor.style.setProperty("--pulse", "0");
  }
  loopCountEl.textContent = `${trackCount} loop${trackCount === 1 ? "" : "s"}`;

  const slots = sourceNames.map((name, index) => ({
    name,
    track: tracks[index]
  }));

  slots.forEach((slot, index) => {
    const track = slot.track;
    const row = trackTemplate.content.firstElementChild.cloneNode(true);
    const muteButton = row.querySelector(".mute");
    const title = row.querySelector("strong");
    const meta = row.querySelector("span");
    const gain = row.querySelector(".gain");

    row.classList.toggle("empty", !track);
    title.textContent = slot.name;
    meta.textContent = track ? `${formatTime(track.buffer.duration)} loop` : "ready";
    gain.value = track ? track.gainNode.gain.value : 0;
    gain.disabled = !track;
    muteButton.disabled = !track;
    muteButton.classList.toggle("active", Boolean(track?.muted));

    muteButton.addEventListener("click", () => {
      if (!track) return;
      track.muted = !track.muted;
      track.gainNode.gain.value = track.muted ? 0 : Number(gain.value);
      muteButton.classList.toggle("active", track.muted);
    });

    gain.addEventListener("input", () => {
      if (!track) return;
      if (!track.muted) {
        track.gainNode.gain.value = Number(gain.value);
      }
    });

    tracksEl.append(row);
  });

  updateAllSourceSlotStates();
}

function updateSourceSlotState(slotIndex) {
  const slot = sourceGrid.children[slotIndex];
  const track = tracks[slotIndex];
  if (!slot) return;
  const isGroupStopped = groupStopped[Math.floor(slotIndex / 4)];
  const buttonArt = slot.querySelector(".source-button-art");
  const stateIcon = slot.querySelector(".source-state-icon");

  slot.classList.toggle("has-loop", Boolean(track));
  slot.classList.toggle("paused", Boolean(track && !track.isPlaying));
  slot.classList.toggle("group-paused", Boolean(track && isGroupStopped));
  slot.classList.toggle("playing", Boolean(track && track.isPlaying && isPlaying && !isGroupStopped));
  slot.querySelector(".source-time").textContent = track ? formatTime(getTrackPosition(track)) : "00:00";

  if (buttonArt) {
    buttonArt.src = slot.classList.contains("recording")
      ? "./resource/source_stop_btn.svg"
      : "./resource/source_normal_btn.svg";
  }

  if (stateIcon) {
    stateIcon.src = !track
      ? "./resource/icon_rec.svg"
      : track.isPlaying && !isGroupStopped
        ? "./resource/icon_temporarystop.svg"
        : "./resource/icon_play.svg";
  }
}

function updateAllSourceSlotStates() {
  sourceNames.forEach((_, index) => updateSourceSlotState(index));
}

function syncOptionButton(index) {
  const button = optionGrid.children[index];
  if (!button) return;
  const image = button.querySelector("img");
  const label = button.querySelector(".option-label");
  const status = button.querySelector(".option-status");
  const isOn = optionStates[index];
  button.setAttribute("aria-pressed", String(isOn));
  button.dataset.status = isOn ? "ON" : "OFF";
  if (label) label.textContent = optionNames[index];
  if (status) status.textContent = isOn ? "ON" : "OFF";
  image.src = `./resource/${isOn ? "togle_on" : "togle_off"}.svg`;
  if (optionKeys[index] === "disk") {
    stage.classList.toggle("disk-ui-on", isOn);
    stage.classList.toggle("disk-ui-off", !isOn);
  }
  if (optionKeys[index] === "piano") {
    stage.classList.toggle("piano-open", isOn);
    pianoPanel.setAttribute("aria-hidden", String(!isOn));
  }
}

function makeDefaultBeatBuffer() {
  const bpm = 96;
  const beats = 8;
  const duration = (60 / bpm) * beats;
  const sampleRate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
  const data = buffer.getChannelData(0);
  const beatStep = 60 / bpm;

  for (let beat = 0; beat < beats; beat += 1) {
    const start = Math.floor(beat * beatStep * sampleRate);
    const isKick = beat % 2 === 0;
    const isSnare = beat % 4 === 2;

    for (let i = 0; i < Math.floor(0.18 * sampleRate); i += 1) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * (isKick ? 24 : 18));
      const tone = Math.sin(2 * Math.PI * (isKick ? 54 + t * 80 : 180) * t);
      const noise = (Math.random() * 2 - 1) * (isSnare ? 0.32 : 0.05);
      const index = start + i;
      if (index < data.length) data[index] += (tone * 0.7 + noise) * envelope;
    }

    const hatStart = Math.floor((beat * beatStep + beatStep * 0.5) * sampleRate);
    for (let i = 0; i < Math.floor(0.055 * sampleRate); i += 1) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 70);
      const index = hatStart + i;
      if (index < data.length) data[index] += (Math.random() * 2 - 1) * 0.16 * envelope;
    }
  }

  return buffer;
}

function makeIntervalBuffer(sourceBuffer, intervalFactor = 1) {
  const factor = Math.max(0.5, Math.min(2, intervalFactor));
  if (!sourceBuffer || Math.abs(factor - 1) < 0.001) return sourceBuffer;

  const sampleRate = sourceBuffer.sampleRate;
  const channelCount = sourceBuffer.numberOfChannels;
  const targetLength = Math.max(
    Math.floor(sampleRate * 0.16),
    Math.floor(sourceBuffer.length * factor)
  );
  const intervalBuffer = audioCtx.createBuffer(channelCount, targetLength, sampleRate);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const targetData = intervalBuffer.getChannelData(channel);

    if (targetLength < sourceBuffer.length) {
      const overlapCount = Math.ceil(sourceBuffer.length / targetLength);
      const overlapGain = 1 / Math.sqrt(overlapCount);

      for (let index = 0; index < sourceData.length; index += 1) {
        targetData[index % targetLength] += sourceData[index] * overlapGain;
      }

      for (let index = 0; index < targetData.length; index += 1) {
        const sample = targetData[index];
        targetData[index] = sample / (1 + Math.abs(sample) * 0.28);
      }
      continue;
    }

    targetData.set(sourceData);

    if (sourceData.length > 64) {
      const fadeLength = Math.min(512, Math.floor(sourceData.length / 3));
      for (let index = 0; index < fadeLength; index += 1) {
        const targetIndex = sourceData.length - fadeLength + index;
        targetData[targetIndex] *= 1 - index / fadeLength;
      }
    }
  }

  return intervalBuffer;
}

function updateSourceIntervalVisual(slotIndex) {
  const slot = sourceGrid.children[slotIndex];
  if (!slot) return;
  const value = slot.querySelector(".source-interval-value");
  if (value) value.textContent = `${sourceIntervals[slotIndex].toFixed(2)}x`;
}

function applyTrackInterval(slotIndex, preservePosition = true) {
  const track = tracks[slotIndex];
  if (!track?.originalBuffer) {
    updateSourceIntervalVisual(slotIndex);
    return;
  }

  const wasPlaying = Boolean(track.source);
  const position = preservePosition ? getTrackPosition(track) : 0;
  if (track.source) stopTrack(track, true);
  track.buffer = makeIntervalBuffer(track.originalBuffer, sourceIntervals[slotIndex]);
  track.pausedAt = track.buffer.duration ? position % track.buffer.duration : 0;
  refreshLoopDuration();
  if (wasPlaying && track.isPlaying && isPlaying) {
    startTrack(track);
  }
  updateSourceSlotState(slotIndex);
  updateSourceIntervalVisual(slotIndex);
  updateProgressUi();
}

function changeSourceInterval(slotIndex, delta) {
  const next = Math.max(0.5, Math.min(2, Number((sourceIntervals[slotIndex] + delta).toFixed(2))));
  if (next === sourceIntervals[slotIndex]) return;
  sourceIntervals[slotIndex] = next;
  applyTrackInterval(slotIndex);
  if (!sourcePopup.hidden && sourcePopup.dataset.slot === String(slotIndex)) {
    updateSourcePopupControls(slotIndex);
  }
  setStatus(`Loop ${next.toFixed(2)}x`);
}

async function createDefaultBeat() {
  await ensureEngine(false);
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  if (beatSlotIndex !== null && tracks[beatSlotIndex]?.isDefaultBeat) return true;

  const slotIndex = tracks.findIndex((track) => !track);
  if (slotIndex === -1) {
    setStatus("No empty slot", "error");
    return false;
  }

  const gainNode = audioCtx.createGain();
  const originalBuffer = makeDefaultBeatBuffer();
  const track = {
    id: `default-beat-${Date.now()}`,
    name: "기본비트",
    slotIndex,
    buffer: makeIntervalBuffer(originalBuffer, sourceIntervals[slotIndex]),
    originalBuffer,
    gainNode,
    source: null,
    muted: false,
    originalBlob: null,
    isPlaying: true,
    pausedAt: 0,
    startedAt: 0,
    volume: 0.82,
    isDefaultBeat: true
  };

  connectTrack(track);
  tracks[slotIndex] = track;
  beatSlotIndex = slotIndex;
  sourceNames[slotIndex] = "기본비트";
  sourceGrid.children[slotIndex].querySelector(".source-title").textContent = "기본비트";
  setTrackVolume(slotIndex, track.volume);
  const hadLoop = loopDuration > 0;
  refreshLoopDuration();
  if (isPlaying) {
    if (!hadLoop) {
      pausedAt = 0;
      playbackStartedAt = audioCtx.currentTime;
    } else {
      playbackStartedAt = audioCtx.currentTime - getLoopPosition();
    }
    startTrack(track);
  }
  renderTracks();
  updateProgressUi();
  setStatus("Beat on");
  return true;
}

function removeDefaultBeat() {
  if (beatSlotIndex === null || !tracks[beatSlotIndex]?.isDefaultBeat) {
    beatSlotIndex = null;
    return;
  }
  const slotIndex = beatSlotIndex;
  beatSlotIndex = null;
  clearTrackAt(slotIndex);
  sourceNames[slotIndex] = `G1-${slotIndex + 1}`;
  sourceGrid.children[slotIndex].querySelector(".source-title").textContent = sourceNames[slotIndex];
  setStatus("Beat off");
}

async function checkAuxInput() {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "audioinput").length > 1;
}

async function startPadRecording(button, name, slotIndex) {
  if (activePad) return;

  try {
    await ensureAudio();
    if (!pressedButtons.has(button)) return;

    const chunks = [];
    const startedAt = performance.now();
    const recorderInput = createProcessedRecorderStream();
    const recorder = new MediaRecorder(recorderInput.stream);
    mediaRecorder = recorder;
    activePad = {
      button,
      name,
      slotIndex,
      chunks,
      startedAt,
      cleanup: recorderInput.cleanup,
      bassShift: isOptionOn("bass"),
      robotize: isOptionOn("robot")
    };
    button.classList.add("recording");
    updateSourceSlotState(slotIndex);
    setStatus("Recording", "recording");
    hint.textContent = `${name} 녹음 중`;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener("stop", async () => {
      const captured = activePad;
      activePad = null;
      button.classList.remove("recording");
      updateSourceSlotState(captured?.slotIndex ?? 0);
      captured?.cleanup?.();

      if (!captured || captured.cancelled || captured.chunks.length === 0) {
        setStatus("Mic on");
        return;
      }

      const blob = new Blob(captured.chunks, { type: recorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      let originalBuffer = captured.bassShift ? makeBassPitchBuffer(decodedBuffer) : decodedBuffer;
      if (captured.robotize) {
        originalBuffer = makeRobotBuffer(originalBuffer);
      }
      const buffer = makeIntervalBuffer(originalBuffer, sourceIntervals[captured.slotIndex]);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1;

      if (tracks[captured.slotIndex]) {
        stopTrack(tracks[captured.slotIndex]);
        tracks[captured.slotIndex].gainNode.disconnect();
      }

      const track = {
        id: crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`,
        name: captured.name,
        slotIndex: captured.slotIndex,
        buffer,
        originalBuffer,
        gainNode,
        source: null,
        muted: false,
        originalBlob: blob,
        isBassShifted: captured.bassShift,
        isRobotized: captured.robotize,
        isPlaying: true,
        pausedAt: 0,
        startedAt: 0,
        volume: 1,
        isDefaultBeat: false
      };

      connectTrack(track);
      tracks[captured.slotIndex] = track;
      setTrackVolume(captured.slotIndex, 1);
      const hadLoop = loopDuration > 0;
      refreshLoopDuration();
      if (isPlaying) {
        if (!hadLoop) {
          pausedAt = 0;
          playbackStartedAt = audioCtx.currentTime;
        } else {
          playbackStartedAt = audioCtx.currentTime - getLoopPosition();
        }
      }
      startTrack(track);
      button.classList.add("has-loop");
      updateSourceSlotState(captured.slotIndex);
      renderTracks();
      setStatus("Looping");
      hint.textContent = "다른 소스를 겹쳐 화음을 만들 수 있습니다";
    });

    recorder.start();
    button.querySelector(".source-time").textContent = "rec";
    requestAnimationFrame(function tick() {
      if (!activePad || activePad.button !== button) return;
      button.querySelector(".source-time").textContent = formatTime(
        (performance.now() - startedAt) / 1000
      );
      requestAnimationFrame(tick);
    });
  } catch (error) {
    const isUnsupported = error.message.includes("supported");
    const isMicOff = error.message.includes("option is off");
    const needsHttps = error.message.includes("HTTPS");
    setStatus(
      needsHttps ? "HTTPS needed" : isUnsupported ? "Unsupported" : isMicOff ? "Mic off" : "Mic blocked",
      "error"
    );
    hint.textContent = isUnsupported
      ? "이 브라우저는 실시간 녹음을 지원하지 않습니다"
      : needsHttps
        ? "모바일 마이크는 HTTPS 주소에서 테스트해야 합니다"
      : isMicOff
        ? "상단 MIC 토글을 켜야 녹음할 수 있습니다"
      : "마이크 권한을 허용해야 녹음할 수 있습니다";
  }
}

function renderOptions() {
  optionGrid.innerHTML = "";

  optionNames.forEach((name, index) => {
    const key = optionKeys[index];
    const button = optionTemplate.content.firstElementChild.cloneNode(true);
    const label = button.querySelector(".option-label");

    button.setAttribute("aria-label", `${name} 옵션 ${optionStates[index] ? "켜짐" : "꺼짐"}`);
    button.dataset.label = name;
    button.dataset.option = key;
    label.textContent = name;
    attachTouchFeedback(button);

    button.addEventListener("click", async () => {
      optionStates[index] = !optionStates[index];
      syncOptionButton(index);

      if (key === "beat") {
        if (optionStates[index]) {
          try {
            if (!(await createDefaultBeat())) {
              optionStates[index] = false;
            }
          } catch (error) {
            optionStates[index] = false;
            setStatus("Beat failed", "error");
          }
        } else {
          removeDefaultBeat();
        }
      }

      if (key === "echo") {
        setStatus(optionStates[index] ? "Echo on" : "Echo off");
      }

      if (key === "bass") {
        setStatus(optionStates[index] ? "Bass on" : "Bass off");
      }

      if (key === "mic") {
        if (optionStates[index]) {
          try {
            await ensureAudio();
          } catch (error) {
            optionStates[index] = false;
            setStatus(error.message.includes("HTTPS") ? "HTTPS needed" : "Mic blocked", "error");
            hint.textContent = error.message.includes("HTTPS")
              ? "모바일 마이크는 HTTPS 주소에서 테스트해야 합니다"
              : "마이크 권한을 허용해야 녹음할 수 있습니다";
          }
        } else {
          stopMicInput();
        }
      }

      if (key === "aux") {
        if (optionStates[index]) {
          const hasAux = await checkAuxInput();
          if (hasAux) {
            setStatus("AUX on");
          } else {
            optionStates[index] = false;
            setStatus("No AUX", "error");
          }
        } else {
          setStatus("AUX off");
        }
      }

      if (key === "disk") {
        setStatus(optionStates[index] ? "Disk UI on" : "Disk UI off");
      }

      if (key === "piano") {
        if (!optionStates[index]) {
          stopAllPianoNotes();
        }
        setStatus(optionStates[index] ? "Piano on" : "Piano off");
      }

      if (key === "robot") {
        setStatus(optionStates[index] ? "Robot on" : "Robot off");
      }

      button.setAttribute("aria-label", `${name} 옵션 ${optionStates[index] ? "켜짐" : "꺼짐"}`);
      syncOptionButton(index);
    });

    optionGrid.append(button);
    syncOptionButton(index);
  });
}

function attachTouchFeedback(control, target = control) {
  control.addEventListener("pointerdown", () => target.classList.add("touching"));
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    control.addEventListener(eventName, () => target.classList.remove("touching"));
  });
}

function isOptionOn(key) {
  return Boolean(optionStates[optionIndexByKey[key]]);
}

function setOptionOn(key, value) {
  const index = optionIndexByKey[key];
  if (index === undefined) return;
  optionStates[index] = value;
  syncOptionButton(index);
}

function createPianoKey(note, midi, type, keyIndex) {
  const key = document.createElement("button");
  key.type = "button";
  key.className = `piano-key ${type}`;
  key.dataset.note = note;
  key.dataset.midi = String(midi);
  key.style.setProperty("--key-index", keyIndex);
  key.setAttribute("aria-label", `${note} 건반`);

  key.addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    if (!isOptionOn("piano")) return;
    key.setPointerCapture(event.pointerId);
    try {
      await startPianoNote(event.pointerId, midi, key);
    } catch (error) {
      setStatus("Piano failed", "error");
    }
  });

  key.addEventListener("pointerup", (event) => stopPianoNote(event.pointerId));
  key.addEventListener("pointercancel", (event) => stopPianoNote(event.pointerId));
  key.addEventListener("pointerleave", (event) => {
    if (!activePianoNotes.has(event.pointerId)) return;
    stopPianoNote(event.pointerId);
  });

  return key;
}

function renderPianoKeys() {
  pianoKeys.innerHTML = "";
  pianoWhiteNotes.forEach((key, index) => {
    pianoKeys.append(createPianoKey(key.note, key.midi, "white", index));
  });
  pianoBlackNotes.forEach((key) => {
    pianoKeys.append(createPianoKey(key.note, key.midi, "black", key.afterWhite));
  });
}

function stopPadRecording(button) {
  if (!activePad || activePad.button !== button || !mediaRecorder) return;
  const elapsed = performance.now() - activePad.startedAt;
  button.querySelector(".source-time").textContent = "loop";

  if (elapsed < 260) {
    button.classList.remove("recording");
    updateSourceSlotState(activePad.slotIndex);
    activePad.cancelled = true;
    mediaRecorder.stop();
    hint.textContent = "조금 더 길게 눌러 소스를 녹음하세요";
    return;
  }

  mediaRecorder.stop();
}

function closeSourcePopup() {
  sourcePopup.hidden = true;
  sourceDim.hidden = true;
  sourcePopup.dataset.slot = "";
  sourceGrid.querySelectorAll(".source-slot.popup-focused").forEach((slot) => {
    slot.classList.remove("popup-focused");
  });
}

function openSourcePopup(slot, slotIndex) {
  if (!sourcePopup.hidden && sourcePopup.dataset.slot === String(slotIndex)) {
    closeSourcePopup();
    return;
  }

  const rect = slot.getBoundingClientRect();
  const stageRect = document.querySelector(".stage").getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const x = Math.max(24, Math.min(76, ((centerX - stageRect.left) / stageRect.width) * 100));
  const y = Math.max(28, Math.min(62, ((centerY - stageRect.top) / stageRect.height) * 100 - 12));

  sourcePopup.style.left = `${x}%`;
  sourcePopup.style.top = `${y}%`;
  sourcePopup.dataset.slot = String(slotIndex);
  sourceGrid.querySelectorAll(".source-slot.popup-focused").forEach((sourceSlot) => {
    sourceSlot.classList.remove("popup-focused");
  });
  slot.classList.add("popup-focused");
  updateSourcePopupControls(slotIndex);
  sourceDim.hidden = false;
  sourcePopup.hidden = false;
}

function clearSourceLongPress() {
  clearTimeout(sourceLongPress.timer);
  sourceLongPress.timer = 0;
  sourceLongPress.index = null;
  sourceLongPress.opened = false;
}

function scheduleSourceLongPress(slot, slotIndex) {
  clearSourceLongPress();
  sourceLongPress.index = slotIndex;
  sourceLongPress.opened = false;
  sourceLongPress.timer = setTimeout(() => {
    if (sourceLongPress.index !== slotIndex || !tracks[slotIndex]) return;
    sourceLongPress.opened = true;
    openSourcePopup(slot, slotIndex);
    if (navigator.vibrate) navigator.vibrate(10);
  }, 520);
}

function updateSourcePopupControls(slotIndex) {
  const track = tracks[slotIndex];
  const volume = track ? track.volume ?? track.gainNode.gain.value : 0;
  const volumePercent = track ? Math.round(volume * 100) : 0;
  const normalized = Math.round((volume / 1.25) * 100);
  const title = track?.name || sourceNames[slotIndex] || `G${Math.floor(slotIndex / 4) + 1}-${(slotIndex % 4) + 1}`;
  sourcePopupTitle.textContent = title;
  sourcePopupVolume.textContent = track ? String(volumePercent) : "--";
  sourcePopupInterval.textContent = `${sourceIntervals[slotIndex].toFixed(2)}x`;
  sourcePopup.style.setProperty("--popup-volume-level", `${Math.max(0, Math.min(100, normalized))}%`);
  if (sourcePopupVolumeMeter) sourcePopupVolumeMeter.style.width = `${Math.max(0, Math.min(100, normalized))}%`;
  sourcePopup.querySelectorAll('[data-adjust^="volume"]').forEach((button) => {
    button.disabled = !track;
  });
}

function clearTrackAt(slotIndex) {
  const track = tracks[slotIndex];
  if (!track) return;
  const wasDefaultBeat = track.isDefaultBeat;
  stopTrack(track);
  track.gainNode.disconnect();
  tracks[slotIndex] = null;
  if (wasDefaultBeat) {
    beatSlotIndex = null;
    setOptionOn("beat", false);
    sourceNames[slotIndex] = `G1-${slotIndex + 1}`;
    sourceGrid.children[slotIndex].querySelector(".source-title").textContent = sourceNames[slotIndex];
  }
  const slot = sourceGrid.children[slotIndex];
  sourceIntervals[slotIndex] = 1;
  slot?.classList.remove("has-loop", "recording", "paused", "group-paused", "playing");
  if (slot) {
    slot.querySelector(".source-time").textContent = "00:00";
    slot.style.setProperty("--progress", "0");
    slot.style.setProperty("--progress-angle", "0deg");
    slot.style.setProperty("--progress-offset", "100");
    slot.style.setProperty("--volume-drag", "0px");
    paintVolumeVisual(slot, 1);
    updateSourceIntervalVisual(slotIndex);
  }
  refreshLoopDuration();
  updateProgressUi();
  if (!tracks.some(Boolean)) {
    waveLevel = 0;
    stage.style.setProperty("--wave", "0");
  }
  renderTracks();
}

function toggleSourcePlayback(slotIndex) {
  const track = tracks[slotIndex];
  if (!track || !audioCtx) return;
  const groupIndex = Math.floor(slotIndex / 4);
  groupStopped[groupIndex] = false;
  groupPanels[groupIndex].classList.remove("stopped");

  if (track.isPlaying) {
    track.isPlaying = false;
    stopTrack(track, true);
  } else {
    track.isPlaying = true;
    startTrack(track);
  }

  updateSourceSlotState(slotIndex);
  updateProgressUi();
}

function paintVolumeVisual(slot, gain) {
  if (!slot) return;
  const volumePercent = Math.round(gain * 100);
  const levelPercent = Math.round((gain / 1.25) * 100);
  slot.dataset.volume = String(volumePercent);
  slot.style.setProperty("--volume-level", `${levelPercent}%`);
  const value = slot.querySelector(".source-volume-value");
  if (value) value.textContent = String(volumePercent);
}

function updateVolumeVisual(slotIndex, gain) {
  paintVolumeVisual(sourceGrid.children[slotIndex], gain);
}

function setTrackVolume(slotIndex, nextGain) {
  const track = tracks[slotIndex];
  if (!track) return;
  const gain = Math.max(0, Math.min(1.25, nextGain));
  track.gainNode.gain.value = track.muted ? 0 : gain;
  track.volume = gain;
  updateVolumeVisual(slotIndex, gain);
  if (!sourcePopup.hidden && sourcePopup.dataset.slot === String(slotIndex)) {
    updateSourcePopupControls(slotIndex);
  }
}

function updateMasterVolume(nextVolume) {
  masterVolume = Math.max(0, Math.min(1.25, nextVolume));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }

  const normalized = masterVolume / 1.25;
  const stageStyles = getComputedStyle(stage);
  const trackTop = Number(stageStyles.getPropertyValue("--master-track-top")) || 54.8611;
  const trackHeight = Number(stageStyles.getPropertyValue("--master-track-height")) || 27.7778;
  const fillTop = trackTop + (1 - normalized) * trackHeight;
  masterBar.style.top = `${trackTop}%`;
  masterBar.style.height = `${trackHeight}%`;
  masterBar.style.transform = `scaleY(${Math.max(0.01, normalized).toFixed(3)})`;
  masterBtn.style.top = `${Math.max(trackTop - 1.2, fillTop - 1.85)}%`;
  const volumePercent = Math.round(masterVolume * 100);
  masterValue.textContent = String(volumePercent);
  masterBtn.setAttribute("aria-label", `전체 볼륨 ${volumePercent}%`);
}

function updatePianoVolume(nextVolume) {
  pianoVolumeLevel = Math.max(0, Math.min(1.25, nextVolume));
  if (pianoGain) {
    pianoGain.gain.value = pianoVolumeLevel;
  }

  const normalized = pianoVolumeLevel / 1.25;
  pianoPanel.style.setProperty("--piano-volume-level", `${Math.round(normalized * 100)}%`);
  pianoPanel.style.setProperty("--piano-volume-knob", `${Math.round((1 - normalized) * 100)}%`);
  const volumePercent = Math.round(pianoVolumeLevel * 100);
  pianoVolumeValue.textContent = String(volumePercent);
  pianoVolume.setAttribute("aria-label", `피아노 볼륨 ${volumePercent}%`);
}

function setMasterVolumeFromPointer(event) {
  const rect = masterTrack.getBoundingClientRect();
  const normalized = 1 - (event.clientY - rect.top) / rect.height;
  updateMasterVolume(normalized * 1.25);
}

function setPianoVolumeFromPointer(event) {
  const rect = pianoVolumeTrack.getBoundingClientRect();
  const normalized = 1 - (event.clientY - rect.top) / rect.height;
  updatePianoVolume(normalized * 1.25);
}

function updateMasterMenu() {
  const playbackButton = masterMenu.querySelector('[data-action="toggle-playback"]');
  if (playbackButton) {
    playbackButton.textContent = isPlaying ? "전체 멈춤" : "전체 재생";
  }
}

function closeMasterMenu() {
  masterMenu.hidden = true;
}

function toggleMasterMenu() {
  updateMasterMenu();
  masterMenu.hidden = !masterMenu.hidden;
}

function toggleGroup(groupIndex) {
  const start = groupIndex * 4;
  const groupTracks = tracks.slice(start, start + 4).filter(Boolean);
  if (!groupTracks.length) return;

  groupStopped[groupIndex] = !groupStopped[groupIndex];
  groupPanels[groupIndex].classList.toggle("stopped", groupStopped[groupIndex]);
  groupPanels[groupIndex].setAttribute(
    "aria-label",
    `${groupNames[groupIndex]} ${groupStopped[groupIndex] ? "그룹 재생" : "그룹 정지"}`
  );

  groupTracks.forEach((track) => {
    if (groupStopped[groupIndex]) {
      track.isPlaying = false;
      stopTrack(track, true);
    } else {
      track.isPlaying = true;
      startTrack(track);
    }
    updateSourceSlotState(track.slotIndex);
  });

  updateProgressUi();
}

function getDiskPointerAngle(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
}

function getAngleDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function getCurrentDiskVisualRotation() {
  const transform = getComputedStyle(kumaDiskArt).transform;
  if (!transform || transform === "none") return diskRotation;
  const Matrix = window.DOMMatrixReadOnly || window.DOMMatrix || window.WebKitCSSMatrix;
  if (!Matrix) return diskRotation;
  const matrix = new Matrix(transform);
  return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

function setDiskRotation(nextRotation) {
  diskRotation = nextRotation;
  stage.style.setProperty("--disk-rotation", `${diskRotation.toFixed(2)}deg`);
}

function setScratchRate(rate) {
  if (!audioCtx) return;
  tracks.filter(Boolean).forEach((track) => {
    if (track.source?.playbackRate) {
      track.source.playbackRate.setTargetAtTime(rate, audioCtx.currentTime, 0.025);
    }
  });
}

function resetScratchRate() {
  clearTimeout(diskHoldTimer);
  setScratchRate(1);
  stage.classList.remove("disk-ui-scratching");
}

function scheduleDiskHoldPause() {
  clearTimeout(diskHoldTimer);
  diskHoldTimer = setTimeout(() => {
    if (!diskDrag) return;
    setScratchRate(0.001);
    diskReactor.style.setProperty("--pulse", "0.92");
    setStatus("Disk hold");
  }, 140);
}

function reverseBuffer(buffer) {
  const reversed = audioCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const sourceData = buffer.getChannelData(channel);
    const reversedData = reversed.getChannelData(channel);
    for (let index = 0; index < sourceData.length; index += 1) {
      reversedData[index] = sourceData[sourceData.length - 1 - index];
    }
  }
  return reversed;
}

function reverseAllLoops() {
  if (!isOptionOn("disk") || !audioCtx) return;
  tracks.filter(Boolean).forEach((track) => {
    stopTrack(track, true);
    track.originalBuffer = reverseBuffer(track.originalBuffer || track.buffer);
    track.buffer = makeIntervalBuffer(track.originalBuffer, sourceIntervals[track.slotIndex]);
    track.pausedAt = track.buffer.duration ? track.buffer.duration - track.pausedAt : 0;
    if (track.isPlaying) startTrack(track);
  });
  updateProgressUi();
  setStatus("Disk reverse");
}

function createSourceButtons() {
  sourceNames.forEach((name, index) => {
    const slot = sourceTemplate.content.firstElementChild.cloneNode(true);
    const recordButton = slot.querySelector(".source-button");
    const menuButton = slot.querySelector(".source-menu-button");
    const intervalMinus = slot.querySelector(".source-interval-minus");
    const intervalPlus = slot.querySelector(".source-interval-plus");

    paintVolumeVisual(slot, 1);
    updateSourceIntervalVisual(index);
    slot.querySelector(".source-title").textContent = name;
    recordButton.setAttribute("aria-label", `${name} 소스 녹음`);
    menuButton.setAttribute("aria-label", `${name} 소스 메뉴`);
    attachTouchFeedback(recordButton, slot);
    attachTouchFeedback(menuButton, menuButton);

    recordButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      closeSourcePopup();
      if (tracks[index]) {
        scheduleSourceLongPress(slot, index);
        recordButton.setPointerCapture(event.pointerId);
        return;
      }
      pressedButtons.add(slot);
      recordButton.setPointerCapture(event.pointerId);
      startPadRecording(slot, name, index);
    });

    recordButton.addEventListener("pointerup", (event) => {
      event.preventDefault();
      if (tracks[index]) {
        const openedByLongPress = sourceLongPress.index === index && sourceLongPress.opened;
        clearSourceLongPress();
        if (openedByLongPress) return;
        toggleSourcePlayback(index);
        return;
      }
      pressedButtons.delete(slot);
      stopPadRecording(slot);
    });

    recordButton.addEventListener("pointercancel", () => {
      clearSourceLongPress();
      pressedButtons.delete(slot);
      stopPadRecording(slot);
    });

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openSourcePopup(slot, index);
    });

    intervalMinus.addEventListener("click", (event) => {
      event.stopPropagation();
      changeSourceInterval(index, -0.25);
    });

    intervalPlus.addEventListener("click", (event) => {
      event.stopPropagation();
      changeSourceInterval(index, 0.25);
    });

    const volumeButton = slot.querySelector(".source-volume-button");
    attachTouchFeedback(volumeButton, slot);
    attachTouchFeedback(intervalMinus, intervalMinus);
    attachTouchFeedback(intervalPlus, intervalPlus);
    volumeButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const track = tracks[index];
      if (!track) return;
      slot.classList.add("volume-dragging");
      volumeDrag.slotIndex = index;
      volumeDrag.startY = event.clientY;
      volumeDrag.startGain = track.volume ?? track.gainNode.gain.value;
      volumeButton.setPointerCapture(event.pointerId);
    });

    volumeButton.addEventListener("pointermove", (event) => {
      if (volumeDrag.slotIndex !== index) return;
      const maxOffset = slot.getBoundingClientRect().height * 0.28;
      const delta = (volumeDrag.startY - event.clientY) / 78;
      const visualOffset = Math.max(
        -maxOffset,
        Math.min(maxOffset, (event.clientY - volumeDrag.startY) * 1.18)
      );
      slot.style.setProperty("--volume-drag", `${visualOffset}px`);
      setTrackVolume(index, volumeDrag.startGain + delta);
    });

    volumeButton.addEventListener("pointerup", () => {
      volumeDrag.slotIndex = null;
      slot.classList.remove("volume-dragging");
      slot.style.setProperty("--volume-drag", "0px");
    });

    volumeButton.addEventListener("pointercancel", () => {
      volumeDrag.slotIndex = null;
      slot.classList.remove("volume-dragging");
      slot.style.setProperty("--volume-drag", "0px");
    });

    sourceGrid.append(slot);
    updateSourceIntervalVisual(index);
  });
}

function sanitizeFileName(name) {
  return name.replace(/[^\w가-힣.-]+/g, "_").replace(/^_+|_+$/g, "") || "kuma-source";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function audioBufferToWavBlob(buffer) {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frameCount = buffer.length;
  const dataSize = frameCount * channelCount * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function writeString(value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * channelCount * 2, true);
  offset += 4;
  view.setUint16(offset, channelCount * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channels = Array.from({ length: channelCount }, (_, channel) =>
    buffer.getChannelData(channel)
  );
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function encodeTrackBlob(track) {
  if ((track.isBassShifted || track.isRobotized) && track.originalBuffer) {
    return audioBufferToWavBlob(track.originalBuffer);
  }
  return track.originalBlob || new Blob([], { type: "audio/webm" });
}

async function createTrackFromBlob(blob, slotIndex, name) {
  await ensureEngine();
  const arrayBuffer = await blob.arrayBuffer();
  const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  const buffer = makeIntervalBuffer(originalBuffer, sourceIntervals[slotIndex]);
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 1;

  if (tracks[slotIndex]) {
    stopTrack(tracks[slotIndex]);
    tracks[slotIndex].gainNode.disconnect();
  }

  const track = {
    id: crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`,
    name,
    slotIndex,
    buffer,
    originalBuffer,
    gainNode,
    source: null,
    muted: false,
    originalBlob: blob,
    isPlaying: true,
    pausedAt: 0,
    startedAt: 0,
    volume: 1,
    isDefaultBeat: false
  };

  connectTrack(track);
  tracks[slotIndex] = track;
  setTrackVolume(slotIndex, 1);
  sourceGrid.children[slotIndex]?.classList.add("has-loop");
  const hadLoop = loopDuration > 0;
  refreshLoopDuration();
  if (isPlaying) {
    if (!hadLoop) {
      pausedAt = 0;
      playbackStartedAt = audioCtx.currentTime;
    } else {
      playbackStartedAt = audioCtx.currentTime - getLoopPosition();
    }
    startTrack(track);
  }
  renderTracks();
  updateProgressUi();
  setStatus("Loaded");
}

async function cloneTrackToSlot(track, slotIndex) {
  if (!track.originalBuffer) {
    const blob = encodeTrackBlob(track);
    if (!blob.size) return;
    await createTrackFromBlob(blob, slotIndex, `${track.name} copy`);
    return;
  }

  await ensureEngine();
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 1;
  const originalBuffer = track.originalBuffer || track.buffer;
  const clone = {
    ...track,
    id: crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`,
    name: `${track.name} copy`,
    slotIndex,
    buffer: makeIntervalBuffer(originalBuffer, sourceIntervals[slotIndex]),
    originalBuffer,
    gainNode,
    source: null,
    muted: false,
    isPlaying: true,
    pausedAt: 0,
    startedAt: 0,
    volume: track.volume ?? 1,
    isBassShifted: Boolean(track.isBassShifted),
    isRobotized: Boolean(track.isRobotized),
    isDefaultBeat: false
  };

  if (tracks[slotIndex]) {
    stopTrack(tracks[slotIndex]);
    tracks[slotIndex].gainNode.disconnect();
  }
  connectTrack(clone);
  tracks[slotIndex] = clone;
  setTrackVolume(slotIndex, clone.volume);
  sourceGrid.children[slotIndex]?.classList.add("has-loop");
  refreshLoopDuration();
  if (isPlaying) startTrack(clone);
  renderTracks();
}

async function toggleMixRecording() {
  if (!window.MediaRecorder) {
    setStatus("Unsupported", "error");
    return;
  }

  try {
    await ensureEngine();
    if (isOptionOn("mic")) {
      await ensureAudio();
    }
  } catch (error) {
    setStatus(
      error.message.includes("HTTPS")
        ? "HTTPS needed"
        : error.message.includes("supported")
          ? "Unsupported"
          : "Mic blocked",
      "error"
    );
    return;
  }

  if (mixRecorder?.state === "recording") {
    mixRecorder.stop();
    return;
  }

  mixChunks = [];
  mixRecorder = new MediaRecorder(mixDestination.stream);
  mixRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) mixChunks.push(event.data);
  });
  mixRecorder.addEventListener("stop", () => {
    clearInterval(timerId);
    mixRecBtn.classList.remove("recording");
    mixRecBtn.querySelector("img").src = "./resource/Rec_btn.svg";
    updateRecProgress();
    mixTimerEl.textContent = "00:00";
    setStatus("Mix saved");
    const blob = new Blob(mixChunks, { type: mixRecorder.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kuma-looper-mix-${Date.now()}.webm`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  mixStartedAt = Date.now();
  timerId = setInterval(() => {
    mixTimerEl.textContent = formatTime((Date.now() - mixStartedAt) / 1000);
    updateRecProgress();
  }, 250);
  mixRecorder.start();
  mixRecBtn.classList.add("recording");
  mixRecBtn.querySelector("img").src = "./resource/Rec_stop_btn.svg";
  updateRecProgress();
  setStatus("Mix REC");
}

function togglePlayback() {
  if (!audioCtx) return;
  refreshLoopDuration();
  if (!loopDuration) return;
  isPlaying = !isPlaying;
  playPauseIcon.src = `./resource/${isPlaying ? "icon_temporarystop" : "icon_play"}.svg`;
  if (isPlaying) {
    playbackStartedAt = audioCtx.currentTime - pausedAt;
    tracks.filter(Boolean).forEach(startTrack);
  } else {
    pausedAt = getLoopPosition();
    tracks.filter(Boolean).forEach((track) => stopTrack(track, true));
  }
  updateAllSourceSlotStates();
  updateProgressUi();
  updateMasterMenu();
}

function clearAll() {
  tracks.filter(Boolean).forEach(stopTrack);
  const oldBeatSlotIndex = beatSlotIndex;
  tracks = Array(sourceNames.length).fill(null);
  sourceIntervals.fill(1);
  beatSlotIndex = null;
  setOptionOn("beat", false);
  isPlaying = true;
  playPauseIcon.src = "./resource/icon_temporarystop.svg";
  if (oldBeatSlotIndex !== null) {
    sourceNames[oldBeatSlotIndex] = `G1-${oldBeatSlotIndex + 1}`;
  }
  loopDuration = 0;
  pausedAt = 0;
  playbackStartedAt = audioCtx?.currentTime || 0;
  document.querySelectorAll(".source-button").forEach((button) => {
    button.classList.remove("recording");
  });
  document.querySelectorAll(".source-slot").forEach((slot, index) => {
    slot.classList.remove("has-loop", "recording", "paused", "group-paused", "playing");
    slot.querySelector(".source-time").textContent = "00:00";
    slot.querySelector(".source-title").textContent = sourceNames[index];
    slot.style.setProperty("--progress", "0");
    slot.style.setProperty("--progress-angle", "0deg");
    slot.style.setProperty("--progress-offset", "100");
    slot.style.setProperty("--volume-drag", "0px");
    paintVolumeVisual(slot, 1);
    updateSourceIntervalVisual(index);
  });
  groupStopped.fill(false);
  groupPanels.forEach((panel, index) => {
    panel.classList.remove("stopped");
    panel.setAttribute("aria-label", `${groupNames[index]} 그룹 정지`);
  });
  renderTracks();
  updateProgressUi();
  updateMasterMenu();
  waveLevel = 0;
  stage.style.setProperty("--wave", "0");
  hint.textContent = "소스 버튼을 누르고 있는 동안 녹음됩니다";
  setStatus(inputStream ? "Mic on" : "Mic ready");
}

function drawScope() {
  const data = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    requestAnimationFrame(draw);
    updateProgressUi();
    updateRecProgress();
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.fillStyle = "#11130f";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 4;
    canvasCtx.strokeStyle = "#8bd6b4";
    canvasCtx.beginPath();

    const slice = canvas.width / data.length;
    data.forEach((value, index) => {
      const x = index * slice;
      const y = (value / 255) * canvas.height;
      const centered = value - 128;
      sum += centered * centered;
      if (index === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
    });

    canvasCtx.stroke();
    const rms = Math.sqrt(sum / data.length) / 128;
    const hasRecordedLoop = tracks.some(Boolean);
    if (!hasRecordedLoop) {
      waveLevel = 0;
      diskReactor.style.setProperty("--pulse", "0");
      stage.style.setProperty("--wave", "0");
      return;
    }
    const hasPlayingTrack = tracks.some(
      (track) => track?.source && !track.muted && (track.volume ?? track.gainNode.gain.value) > 0.01
    );
    const hasLiveInput = Boolean(activePad || activePianoNotes.size);
    const hasAudibleOutput = hasPlayingTrack || hasLiveInput || isRecordingMix;
    const pulse = hasAudibleOutput && rms > 0.045 ? Math.min(1, rms * 4.8) : 0;
    const targetWave =
      hasAudibleOutput && rms > 0.045
        ? Math.min(0.42, (rms - 0.045) * 3.2)
        : 0;
    const ease = targetWave > waveLevel ? 0.32 : 0.16;
    waveLevel += (targetWave - waveLevel) * ease;
    if (waveLevel < 0.01) waveLevel = 0;
    diskReactor.style.setProperty("--pulse", pulse.toFixed(3));
    stage.style.setProperty("--wave", waveLevel.toFixed(3));
  }

  draw();
}

function startUiLoop() {
  updateProgressUi();
  updateRecProgress();
  requestAnimationFrame(startUiLoop);
}

renderPianoKeys();
renderOptions();
createSourceButtons();
renderTracks();
startUiLoop();
updateMasterVolume(masterVolume);
updatePianoVolume(pianoVolumeLevel);
[
  mixRecBtn,
  playPauseBtn,
  clearBtn,
  masterBtn,
  ...groupPanels
].forEach((button) => attachTouchFeedback(button));
mixRecBtn.addEventListener("click", toggleMixRecording);
playPauseBtn.addEventListener("click", togglePlayback);
clearBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  closeSourcePopup();
  toggleMasterMenu();
});

function startMasterVolumeDrag(event) {
  event.preventDefault();
  masterDrag = event.pointerId;
  masterBtn.classList.add("active");
  event.currentTarget.setPointerCapture(event.pointerId);
  setMasterVolumeFromPointer(event);
}

function moveMasterVolumeDrag(event) {
  if (masterDrag !== event.pointerId) return;
  setMasterVolumeFromPointer(event);
}

function stopMasterVolumeDrag(event) {
  if (masterDrag !== event.pointerId) return;
  masterDrag = null;
  masterBtn.classList.remove("active");
}

[masterTrack, masterBar, masterBtn].forEach((control) => {
  control.addEventListener("pointerdown", startMasterVolumeDrag);
  control.addEventListener("pointermove", moveMasterVolumeDrag);
  control.addEventListener("pointerup", stopMasterVolumeDrag);
  control.addEventListener("pointercancel", stopMasterVolumeDrag);
});

function startPianoVolumeDrag(event) {
  event.preventDefault();
  pianoVolumeDrag = event.pointerId;
  pianoVolume.classList.add("dragging");
  event.currentTarget.setPointerCapture(event.pointerId);
  setPianoVolumeFromPointer(event);
}

function movePianoVolumeDrag(event) {
  if (pianoVolumeDrag !== event.pointerId) return;
  setPianoVolumeFromPointer(event);
}

function stopPianoVolumeDrag(event) {
  if (pianoVolumeDrag !== event.pointerId) return;
  pianoVolumeDrag = null;
  pianoVolume.classList.remove("dragging");
}

[pianoVolume, pianoVolumeTrack].forEach((control) => {
  control.addEventListener("pointerdown", startPianoVolumeDrag);
  control.addEventListener("pointermove", movePianoVolumeDrag);
  control.addEventListener("pointerup", stopPianoVolumeDrag);
  control.addEventListener("pointercancel", stopPianoVolumeDrag);
});

["selectstart", "dragstart", "contextmenu"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (event.target instanceof Element && event.target.closest("input[type='file']")) return;
    event.preventDefault();
  });
});

["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
  document.addEventListener(
    eventName,
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
});

let lastTouchEndAt = 0;
document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - lastTouchEndAt < 360) {
      event.preventDefault();
    }
    lastTouchEndAt = now;
  },
  { passive: false }
);

masterMenu.addEventListener("click", (event) => {
  const action = event.target.closest("button")?.dataset.action;
  if (!action) return;

  if (action === "clear-all") {
    clearAll();
  }

  if (action === "toggle-playback") {
    togglePlayback();
  }

  closeMasterMenu();
});
diskArt.addEventListener("pointerdown", (event) => {
  if (!isOptionOn("disk")) return;
  event.preventDefault();
  const startAngle = getDiskPointerAngle(event);
  const startRotation = getCurrentDiskVisualRotation();
  setDiskRotation(startRotation);
  diskDrag = {
    startAngle,
    lastAngle: startAngle,
    lastMoveAt: performance.now(),
    startRotation,
    pointerId: event.pointerId
  };
  stage.classList.add("disk-ui-scratching");
  setScratchRate(0.001);
  diskReactor.style.setProperty("--pulse", "0.86");
  setStatus("Disk hold");
  scheduleDiskHoldPause();
  event.currentTarget.setPointerCapture(event.pointerId);
});
diskArt.addEventListener("pointermove", (event) => {
  if (!diskDrag || diskDrag.pointerId !== event.pointerId) return;
  clearTimeout(diskHoldTimer);
  const now = performance.now();
  const angle = getDiskPointerAngle(event);
  const totalDelta = getAngleDelta(diskDrag.startAngle, angle);
  const stepDelta = getAngleDelta(diskDrag.lastAngle, angle);
  const elapsed = Math.max(16, now - diskDrag.lastMoveAt);
  setDiskRotation(diskDrag.startRotation + totalDelta);
  const velocity = stepDelta / elapsed;
  const rate = Math.max(0.18, Math.min(1.85, 1 + velocity * 22));
  setScratchRate(rate);
  diskReactor.style.setProperty(
    "--pulse",
    Math.min(1, Math.abs(stepDelta) / 16 + 0.22).toFixed(3)
  );
  diskDrag.lastAngle = angle;
  diskDrag.lastMoveAt = now;
  scheduleDiskHoldPause();
});
diskArt.addEventListener("pointerup", () => {
  diskDrag = null;
  resetScratchRate();
  setStatus("Disk UI on");
});
diskArt.addEventListener("pointercancel", () => {
  diskDrag = null;
  resetScratchRate();
  setStatus("Disk UI on");
});
diskArt.addEventListener("dblclick", reverseAllLoops);
groupPanels.forEach((button, index) => {
  button.addEventListener("click", () => toggleGroup(index));
});
sourcePopup.addEventListener("click", (event) => {
  const slotIndex = Number(sourcePopup.dataset.slot);
  const track = tracks[slotIndex];
  const button = event.target.closest("button");
  const adjustment = button?.dataset.adjust;
  const action = button?.dataset.action;

  if (adjustment === "volume-down") {
    if (track) setTrackVolume(slotIndex, (track.volume ?? track.gainNode.gain.value) - 0.1);
    return;
  }

  if (adjustment === "volume-up") {
    if (track) setTrackVolume(slotIndex, (track.volume ?? track.gainNode.gain.value) + 0.1);
    return;
  }

  if (adjustment === "interval-down") {
    changeSourceInterval(slotIndex, -0.25);
    return;
  }

  if (adjustment === "interval-up") {
    changeSourceInterval(slotIndex, 0.25);
    return;
  }

  if (!action) return;

  if (action === "rename") {
    const nextName = prompt("소스 이름", track?.name || sourceNames[slotIndex]);
    if (nextName?.trim()) {
      sourceNames[slotIndex] = nextName.trim();
      if (track) track.name = nextName.trim();
      sourceGrid.children[slotIndex].querySelector(".source-title").textContent = nextName.trim();
      renderTracks();
    }
  }

  if (action === "save") {
    if (!track) {
      setStatus("No source");
    } else {
      const sourceBlob = encodeTrackBlob(track);
      const extension = sourceBlob.type === "audio/wav" ? "wav" : "webm";
      downloadBlob(sourceBlob, `${sanitizeFileName(track.name)}.${extension}`);
      setStatus("Source saved");
    }
  }

  if (action === "load") {
    loadingSlotIndex = slotIndex;
    sourceFileInput.value = "";
    sourceFileInput.click();
  }

  if (action === "copy") {
    copiedTrack = track || null;
    setStatus(copiedTrack ? "Copied" : "No source");
  }

  if (action === "paste") {
    if (copiedTrack) {
      cloneTrackToSlot(copiedTrack, slotIndex);
      setStatus("Pasted");
    } else {
      setStatus("Empty copy");
    }
  }

  if (action === "clear") {
    clearTrackAt(slotIndex);
  }

  closeSourcePopup();
});
sourceFileInput.addEventListener("change", async () => {
  const file = sourceFileInput.files?.[0];
  if (!file || loadingSlotIndex === null) return;
  try {
    await createTrackFromBlob(file, loadingSlotIndex, file.name.replace(/\.[^.]+$/, ""));
    sourceNames[loadingSlotIndex] = file.name.replace(/\.[^.]+$/, "");
    sourceGrid.children[loadingSlotIndex].querySelector(".source-title").textContent =
      sourceNames[loadingSlotIndex];
  } catch (error) {
    setStatus("Load failed");
  } finally {
    loadingSlotIndex = null;
    sourceFileInput.value = "";
  }
});
document.addEventListener("pointerdown", (event) => {
  if (
    !sourcePopup.hidden &&
    !event.target.closest(".source-popup") &&
    !event.target.closest(".source-menu-button")
  ) {
    closeSourcePopup();
  }

  if (
    !masterMenu.hidden &&
    !event.target.closest(".master-menu") &&
    !event.target.closest("#clearBtn")
  ) {
    closeMasterMenu();
  }
});
window.addEventListener("focus", () => {
  if (isPlaying && audioCtx) restartLoops();
});

let responsiveLayoutTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(responsiveLayoutTimer);
  responsiveLayoutTimer = setTimeout(() => {
    updateMasterVolume(masterVolume);
    updatePianoVolume(pianoVolumeLevel);
    closeSourcePopup();
    closeMasterMenu();
  }, 120);
});
