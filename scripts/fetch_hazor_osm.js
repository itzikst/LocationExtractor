const url = 'https://overpass-api.de/api/interpreter?data=[out:json];(node(33.014,35.560,33.022,35.572);way(33.014,35.560,33.022,35.572););out body center;';

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log('Found', data.elements.length, 'elements in Tel Hazor');
    data.elements.forEach(el => {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['name:he'] || tags.description || '';
      const lat = el.lat || (el.center && el.center.lat);
      const lon = el.lon || (el.center && el.center.lon);
      if (name || tags.historic || tags.waterway || tags.man_made || tags.tourism) {
        console.log(`[${el.type} ${el.id}] ${name} | lat: ${lat}, lon: ${lon} | tags: ${JSON.stringify(tags)}`);
      }
    });
  })
  .catch(err => console.error('Error:', err.message));
