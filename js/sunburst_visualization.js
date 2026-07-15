import { AccidentSequences } from './accident_sequences.js';

export const VIZ_CONFIG = {
    dimensions: {
        width: 750,
        height: 750,
        radiusRatio: 20,
        minRadiusScale: 0.2,
        maxRadiusScale: 0.85,
        padding: 0.01
    },
    colors: {
        defaultColor: "#ccc",
        opacity: {
            default: 0.8,
            highlight: 1.0,
            fade: 0.3
        }
    },
    colorScales: {
        timeOfDay: {
            domain: ['plein-jour', 'crepuscule', 'nuit-sans-eclairage', 'nuit-eclairage-eteint', 'nuit-eclairage-allume'],
            range: d3.schemePaired
        },
        weather: {
            domain: ['normal', 'pluie-legere', 'pluie-forte', 'neige-grele', 'brouillard', 'vent-tempete'],
            range: d3.schemeBlues[9]
        },
        location: {
            domain: ['en-agglomeration', 'hors-agglomeration'],
            range: ['#e78ac3', '#a6d854']
        },
        severity: {
            domain: ['indemne', 'blesse-leger', 'hospitalise', 'tue'],
            range: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3']
        }
    }
};
class SunburstVisualization {
    constructor(containerId) {
        this.config = VIZ_CONFIG;
        this.container = d3.select(containerId);
        this.setupDimensions();
        this.setupSVG();
        this.setupColorScales();
        this.setupLayout();
    }

    setupDimensions() {
        this.width = this.config.dimensions.width;
        this.height = this.config.dimensions.height;
        this.radius = Math.min(this.width, this.height) / this.config.dimensions.radiusRatio;
    }

    setupSVG() {
        this.svg = this.container
            .append("svg")
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .append("g")
            .attr("transform", `translate(${this.width / 2},${this.height / 2})`);
    }

    setupColorScales() {
        this.colorScales = {};
        Object.entries(this.config.colorScales).forEach(([level, scale]) => {
            this.colorScales[level] = d3.scaleOrdinal()
                .domain(scale.domain)
                .range(scale.range);
        });
    }

    setupLayout() {
        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(this.radius / 2)
            .innerRadius(d => this.calculateRadius(d, 'inner'))
            .outerRadius(d => this.calculateRadius(d, 'outer'));

        this.partition = d3.partition()
            .size([2 * Math.PI, this.radius]);
    }

    calculateRadius(d, type) {
        const minRadius = this.radius * this.config.dimensions.minRadiusScale;
        const baseRadius = Math.sqrt(d.y0) * this.radius * 0.8;

        if (type === 'inner') {
            return Math.max(minRadius, baseRadius);
        }
        return Math.max(baseRadius, Math.sqrt(d.y1) * this.radius * this.config.dimensions.maxRadiusScale) - 1;
    }

    getColor(d) {
        const scaleKey = Object.keys(this.colorScales)[d.depth - 1];
        return this.colorScales[scaleKey]?.(d.data.name) || this.config.colors.defaultColor;
    }

    update(data) {
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        const nodes = this.partition(root).descendants().slice(1);

        const paths = this.svg.selectAll("path")
            .data(nodes)
            .join("path")
            .attr("fill", d => this.getColor(d))
            .attr("fill-opacity", this.config.colors.opacity.default)
            .attr("d", this.arc);

        this.addInteractivity(paths, root);
    }

    addInteractivity(paths, root) {
        paths
            .on("mouseover", (event, d) => {
                const percentage = (100 * d.value / root.value).toPrecision(3);
                const sequence = d.ancestors().reverse().slice(1);
                this.updateBreadcrumb(sequence, percentage);
                this.highlightSequence(paths, sequence);
            })
            .on("mouseout", () => {
                this.clearBreadcrumb();
                this.resetHighlight(paths);
            });
    }

    updateBreadcrumb(sequence, percentage) {
        const sequenceText = sequence.map(s => s.data.name).join(' > ');
        d3.select("#percentage").html(`
            ${percentage}%<br>
            <span style="font-size: 14px">${sequenceText}</span>
        `);
    }

    clearBreadcrumb() {
        d3.select("#percentage").text("");
    }

    highlightSequence(paths, sequence) {
        paths.attr("fill-opacity", node =>
            sequence.indexOf(node) >= 0 ?
                this.config.colors.opacity.highlight :
                this.config.colors.opacity.fade
        );
    }

    resetHighlight(paths) {
        paths.attr("fill-opacity", this.config.colors.opacity.default);
    }
}

async function initVisualization() {
    try {
        const sequences = new AccidentSequences();
        const data = await sequences.createHierarchicalData();

        const visualization = new SunburstVisualization("#chart");
        visualization.update(data);
    } catch (error) {
        console.error("Error creating visualization:", error);
    }
}

// Initialize visualization when document is ready
document.addEventListener('DOMContentLoaded', initVisualization);