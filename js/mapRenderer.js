const MapRenderer = (() => {
  let worldData = null;

  async function loadWorld() {
    if (worldData) return worldData;
    const res = await fetch('data/countries-110m.json');
    const topo = await res.json();
    worldData = topojson.feature(topo, topo.objects.countries);
    return worldData;
  }

  async function render(containerId, { onClick } = {}) {
    const world = await loadWorld();
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const width = container.clientWidth || 600;
    const height = width * 0.55;

    const projection = d3.geoNaturalEarth1().fitSize([width, height], world);
    const path = d3.geoPath(projection);

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`);

    const zoomLayer = svg.append('g');

    const paths = zoomLayer.selectAll('path')
      .data(world.features)
      .join('path')
      .attr('d', path)
      .attr('class', 'map-country')
      .attr('data-id', d => d.id)
      .on('click', (event, d) => {
        if (onClick) onClick(d.id, d);
      });

    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform);
      });
    svg.call(zoom);

    return {
      svg,
      paths,
      setTarget(numericId) {
        paths.classed('target', d => String(d.id) === String(numericId));
      },
      clearTarget() {
        paths.classed('target', false);
      },
      flash(numericId, type) {
        const cls = type === 'correct' ? 'correct-flash' : type === 'reveal' ? 'reveal-flash' : 'wrong-flash';
        paths.filter(d => String(d.id) === String(numericId)).classed(cls, true);
      },
      clearFlash() {
        paths.classed('correct-flash', false).classed('wrong-flash', false).classed('reveal-flash', false);
      },
      colorByStats(statsLookup) {
        paths.style('fill', d => {
          const ratio = statsLookup(d.id);
          if (ratio === null || ratio === undefined) return null;
          if (ratio <= 0) return '#2a3348';
          const green = Math.round(60 + ratio * 140);
          return `rgb(${Math.round(61 - ratio * 20)}, ${green}, ${Math.round(132 - ratio * 40)})`;
        });
      },
      zoomBy(factor) {
        svg.transition().duration(200).call(zoom.scaleBy, factor);
      },
      resetZoom() {
        svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
      }
    };
  }

  return { render, loadWorld };
})();
