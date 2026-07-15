import * as d3 from 'd3';

// Basic example: create an SVG and add a circle
const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', 600)
    .attr('height', 400);

svg.append('circle')
    .attr('cx', 300)
    .attr('cy', 200)
    .attr('r', 50)
    .style('fill', 'steelblue');