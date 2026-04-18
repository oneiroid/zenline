import moment from 'moment';
import {
    ENTRANCE_STAGGER,
    ENTRANCE_DURATION,
    ENTRANCE_OVERSHOOT,
    LABEL_ENTRANCE_DELAY,
    LABEL_ENTRANCE_DURATION,
    PULSE_PERIOD_MIN,
    PULSE_PERIOD_MAX,
    PULSE_MIN,
    PULSE_MAX,
    PULSE_PEAK_THRESHOLD,
    PULSE_TROUGH_THRESHOLD,
    BOUNDARY_EXPANSION,
    BOUNDARY_GROWTH_POWER,
    BOUNDARY_FADE_POWER,
    WOBBLE_PERIOD_MIN,
    WOBBLE_PERIOD_MAX,
    WOBBLE_AMPLITUDE_PX,
    WOBBLE_ROTATION_DEG,
    TAP_SCALE,
    PALETTE,
    PRELOADER_FADE_MS,
    CROSSFADE_DURATION,
} from './constants.js';
import { prefersReducedMotion } from './utils.js';
import { showGroupView } from './groupView.js';

export class TimelineGroup {
    constructor(data, index, position, container) {
        this.data = data;
        this.index = index;
        this.position = position;
        this.container = container;
        this.reducedMotion = prefersReducedMotion();
        this.focalScale = 1;
        this.pulseScale = 1;
        this.tapScale = 1;
        this.wobbleX = 0;
        this.wobbleY = 0;
        this.wobbleRot = 0;
        this.active = false;
        this.swappedThisCycle = false;
        this.pendingLoads = 0;
        this.activeLayer = 0;
        this.loadTimers = new Set();
        this.initialize();
    }

    initialize() {
        const ariaLabel = `${this.formatDateRange()}, ${this.data.images.length} drawings`;
        this.group = this.container
            .append('g')
            .attr('class', 'timeline-group')
            .attr('transform', `translate(${this.position.x},${this.position.y})`)
            .attr('role', 'button')
            .attr('tabindex', '0')
            .attr('aria-label', ariaLabel);

        this.scaleGroup = this.group.append('g');

        if (this.reducedMotion) {
            this.scaleGroup.attr('transform', 'scale(1)').style('opacity', 1);
        } else {
            this.scaleGroup
                .attr('transform', 'scale(0)')
                .style('opacity', 0)
                .transition()
                .delay(this.index * ENTRANCE_STAGGER)
                .duration(ENTRANCE_DURATION)
                .ease(d3.easeBackOut.overshoot(ENTRANCE_OVERSHOOT))
                .attr('transform', 'scale(1)')
                .style('opacity', 1)
                .on('end', () => this.activate());
        }

        this.boundaryCircle = this.scaleGroup.append('circle')
            .attr('r', this.position.radius)
            .attr('class', 'timeline-group-background')
            .style('fill', '#ffffff')
            .style('stroke', PALETTE.circle_stroke)
            .style('stroke-width', '2.5px');

        this.labelEl = this.group.append('text')
            .attr('class', 'timeline-group-label')
            .attr('y', this.position.radius + 20)
            .attr('text-anchor', 'middle')
            .style('opacity', this.reducedMotion ? 1 : 0);

        this.labelEl.append('tspan')
            .attr('x', 0)
            .text(this.formatDateRange());

        this.labelEl.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .style('font-weight', '300')
            .style('font-size', '10px')
            .text(`${this.data.images.length} drawings`);

        if (!this.reducedMotion) {
            this.labelEl.transition()
                .delay(this.index * ENTRANCE_STAGGER + LABEL_ENTRANCE_DELAY)
                .duration(LABEL_ENTRANCE_DURATION)
                .style('opacity', 1);
        }

        this.imageContainer = this.scaleGroup.append('g')
            .attr('class', 'thumbnail-container');

        this.group.append('defs')
            .append('clipPath')
            .attr('id', `clip-${this.index}`)
            .append('circle')
            .attr('r', this.position.radius);

        this.preloader = this.imageContainer.append('circle')
            .attr('class', 'tg-preloader')
            .attr('r', Math.max(8, this.position.radius * 0.28))
            .attr('cx', 0).attr('cy', 0);

        this.imgLayers = [this.createImageLayer(), this.createImageLayer()];
        this.loadImageIntoLayer(0, true);

        this.group
            .style('cursor', 'pointer')
            .on('touchstart', () => this.setTap(TAP_SCALE), { passive: true })
            .on('touchend', () => this.setTap(1), { passive: true })
            .on('touchcancel', () => this.setTap(1), { passive: true })
            .on('click', () => this.onClick())
            .on('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.onClick();
                }
            });

        this.pulsePeriod = PULSE_PERIOD_MIN + Math.random() * (PULSE_PERIOD_MAX - PULSE_PERIOD_MIN);
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.wobblePeriod = WOBBLE_PERIOD_MIN + Math.random() * (WOBBLE_PERIOD_MAX - WOBBLE_PERIOD_MIN);
        this.wobblePhaseX = Math.random() * Math.PI * 2;
        this.wobblePhaseY = Math.random() * Math.PI * 2;
        this.wobblePhaseRot = Math.random() * Math.PI * 2;
        this.startTime = performance.now();

        if (this.reducedMotion) this.activate();
    }

    activate() {
        this.startTime = performance.now();
        this.active = true;
    }

    formatDateRange() {
        const start = moment(this.data.startDate);
        const end = moment(this.data.endDate);
        if (start.isSame(end, 'month')) {
            return start.format('MMM YYYY');
        }
        if (start.isSame(end, 'year')) {
            return `${start.format('MMM')} – ${end.format('MMM YYYY')}`;
        }
        return `${start.format('MMM YY')} – ${end.format('MMM YY')}`;
    }

    setFocalScale(scale) {
        this.focalScale = scale;
        this.applyTransform();
    }

    setTap(scale) {
        this.tapScale = scale;
        this.applyTransform();
    }

    applyTransform() {
        const s = this.focalScale * this.pulseScale * this.tapScale;
        this.scaleGroup.attr(
            'transform',
            `translate(${this.wobbleX},${this.wobbleY}) rotate(${this.wobbleRot}) scale(${s})`
        );
    }

    tick(now) {
        if (!this.active || this.reducedMotion) return;
        const TWO_PI = Math.PI * 2;
        const elapsed = now - this.startTime;

        const pulseT = elapsed / this.pulsePeriod;
        const wave = (Math.sin(pulseT * TWO_PI + this.pulsePhase) + 1) / 2;
        this.pulseScale = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * wave;

        const expansion = 1 + Math.pow(wave, BOUNDARY_GROWTH_POWER) * BOUNDARY_EXPANSION;
        const opacity = Math.pow(1 - wave, BOUNDARY_FADE_POWER);
        this.boundaryCircle
            .attr('r', this.position.radius * expansion)
            .style('opacity', opacity);

        const wobbleT = elapsed / this.wobblePeriod;
        this.wobbleX = Math.sin(wobbleT * TWO_PI + this.wobblePhaseX) * WOBBLE_AMPLITUDE_PX;
        this.wobbleY = Math.cos(wobbleT * TWO_PI + this.wobblePhaseY) * WOBBLE_AMPLITUDE_PX;
        this.wobbleRot = Math.sin(wobbleT * TWO_PI + this.wobblePhaseRot) * WOBBLE_ROTATION_DEG;

        this.applyTransform();

        if (wave > PULSE_PEAK_THRESHOLD && !this.swappedThisCycle) {
            this.swappedThisCycle = true;
            this.swapLayer();
        } else if (wave < PULSE_TROUGH_THRESHOLD && this.swappedThisCycle) {
            this.swappedThisCycle = false;
        }
    }

    createImageLayer() {
        const r = this.position.radius;
        return this.imageContainer.append('image')
            .attr('class', 'tg-layer')
            .attr('x', -r).attr('y', -r)
            .attr('width', r * 2).attr('height', r * 2)
            .attr('clip-path', `url(#clip-${this.index})`)
            .attr('preserveAspectRatio', 'xMidYMid slice')
            .style('opacity', 0);
    }

    loadImageIntoLayer(idx, usePreloader) {
        const img = this.getRandomImage();
        const href = `/imgs/${img.filename}`;
        const layer = this.imgLayers[idx];
        layer.attr('xlink:href', href);
        this.trackLoad(href, () => {
            layer.transition('fadein').duration(PRELOADER_FADE_MS)
                .ease(d3.easeCubicOut).style('opacity', 1);
        }, usePreloader);
    }

    swapLayer() {
        const nextIdx = 1 - this.activeLayer;
        const currentLayer = this.imgLayers[this.activeLayer];
        const nextLayer = this.imgLayers[nextIdx];
        const img = this.getRandomImage();
        const href = `/imgs/${img.filename}`;
        nextLayer.attr('xlink:href', href);
        // Decode the new image before starting the crossfade so the incoming
        // layer never flashes blank. The outgoing fade-out is gated on the
        // same ready signal so both transitions are perfectly synchronized.
        this.trackLoad(href, () => {
            nextLayer.transition('fadein').duration(CROSSFADE_DURATION)
                .ease(d3.easeCubicInOut).style('opacity', 1);
            currentLayer.transition('fadeout').duration(CROSSFADE_DURATION)
                .ease(d3.easeCubicInOut).style('opacity', 0);
        }, false);
        this.activeLayer = nextIdx;
    }

    trackLoad(href, onReady, usePreloader) {
        if (usePreloader) {
            this.pendingLoads += 1;
            this.updatePreloader();
        }
        let fired = false;
        let safetyId;
        const done = () => {
            if (fired) return;
            fired = true;
            if (safetyId) {
                clearTimeout(safetyId);
                this.loadTimers.delete(safetyId);
            }
            if (usePreloader) {
                this.pendingLoads = Math.max(0, this.pendingLoads - 1);
                this.updatePreloader();
            }
            onReady();
        };
        const probe = new Image();
        probe.onload = done;
        probe.onerror = done;
        probe.src = href;
        safetyId = setTimeout(done, 3000);
        this.loadTimers.add(safetyId);
    }

    updatePreloader() {
        if (!this.preloader) return;
        this.preloader.style('display', this.pendingLoads > 0 ? null : 'none');
    }

    getRandomImage() {
        return this.data.images[Math.floor(Math.random() * this.data.images.length)];
    }

    onClick() {
        showGroupView(this.data);
    }

    destroy() {
        this.active = false;
        for (const id of this.loadTimers) clearTimeout(id);
        this.loadTimers.clear();
        this.group.remove();
    }
}
