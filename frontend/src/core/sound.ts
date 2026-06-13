/**
 * Sound Manager for UI Sound Effects
 * Uses Web Audio API for low-latency playback.
 */

class SoundManagerClass {
    private ctx: AudioContext | null = null;
    private enabled: boolean = true;
    private clickBuffer: AudioBuffer | null = null;

    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initBuffers();
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    private initBuffers() {
        if (!this.ctx) return;

        // Pre-generate a crisp click sound
        const bufferSize = this.ctx.sampleRate * 0.01; // 10ms is plenty for a click
        this.clickBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.clickBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // White noise with exponential decay for a crisp "tick"
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.002));
        }
    }

    private ensureContext() {
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return true;
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    /**
     * Plays a synthesized "Success" ding (C5 -> E5 -> G5)
     */
    public playSuccess() {
        if (!this.enabled || !this.ensureContext()) return;

        const t = this.ctx!.currentTime;
        // Playing slightly shorter, snappier tones
        this.playTone(523.25, 'sine', t, 0.08); // C5
        this.playTone(659.25, 'sine', t + 0.08, 0.08); // E5
    }

    /**
     * Plays a synthesized "Error" thud
     */
    public playError() {
        if (!this.enabled || !this.ensureContext()) return;
        const t = this.ctx!.currentTime;
        this.playTone(150, 'sawtooth', t, 0.1);
        this.playTone(100, 'sawtooth', t + 0.05, 0.15);
    }

    /**
     * Plays a detailed "Warning" beep
     */
    public playWarning() {
        if (!this.enabled || !this.ensureContext()) return;
        const t = this.ctx!.currentTime;
        this.playTone(440, 'triangle', t, 0.1);
    }

    /**
     * Plays a cached, ultra-low latency click
     */
    public playClick() {
        if (!this.enabled || !this.clickBuffer || !this.ensureContext()) return;

        // Use a simple buffer source for maximum speed
        const source = this.ctx!.createBufferSource();
        source.buffer = this.clickBuffer;

        // Bypass gain node if possible for speed, or simple connection
        const gain = this.ctx!.createGain();
        gain.gain.value = 0.15; // Slightly louder but short

        source.connect(gain);
        gain.connect(this.ctx!.destination);
        source.start(0);
    }

    private playTone(freq: number, type: OscillatorType, startTime: number, duration: number) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        // Sharper envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}

export const SoundManager = new SoundManagerClass();
