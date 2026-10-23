const root = 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/scenes/';
const movie = (name, note, source) => ({
  file: `assets/video/${name}.mp4`, poster: `assets/images/${name}-stage-poster.webp`,
  note, source: new URL(source, root).href
});
const missingH3 = {
  unavailable: 'A full H3 render is not available for this scene.',
  note: 'The generated geometry and material stages are shown at their original timing.'
};

export const stages = [
  { key: 'gray', number: '01', title: 'Gray mesh', subtitle: 'Our generated geometry' },
  { key: 'material', number: '02', title: 'Our mesh + materials', subtitle: 'Materials on the 3D assets' },
  { key: 'h3', number: '03', title: 'H3 render', subtitle: 'Video-model rendering' }
];

export const scenes = {
  transform: {
    title: 'Transform, reconfigure, and drive.', duration: 30,
    label: '30 SECONDS / TRANSFORMATION & PART REPLACEMENT',
    copy: 'A generated vehicle transforms into a robot, exchanges its arms for a cannon and shield, runs, then returns to driving with its new parts.',
    note: 'The gray and material views share the V53 geometry, camera and animation. H3 uses the earlier V3 geometry and its original control; the authored timeline is shared.',
    source: root + 'transformers.html#robot-semantic-pixal-v53',
    views: {
      gray: movie('transform-v53-gray', 'Neutral materials on the same V53 mesh and animation.', 'transformers.html#robot-semantic-pixal-v53'),
      material: movie('transform-v53-material', 'Pixal3D materials on the V53 semantic body modules.', 'transformers.html#robot-semantic-pixal-v53'),
      h3: movie('transform-v55', 'Reviewed complete V55 film. H3 input: earlier V3 geometry.', 'transformers.html#robot-part-replacement-full-trial-v3')
    },
    chapters: [[0, 'Drive'], [5, 'Transform'], [10, 'Replace parts'], [17, 'Run'], [23, 'Drive again']]
  },
  home: {
    title: 'Walk into a world that assembles around you.', duration: 974 / 24,
    label: '40.6 SECONDS / OUTDOORS TO INDOORS',
    copy: 'Generated building modules, characters and furniture make a homestead. Follow a character through the door as its furnishings assemble, then look back outside.',
    note: 'The gray and material views use the V95 house and landscape. H3 uses earlier V68 scene geometry; the authored camera and assembly timeline are shared.',
    source: root + 'world.html#world-house-landscape-v95',
    views: {
      gray: movie('home-v95-gray', 'Neutral materials on the V95 geometry, camera and animation.', 'world.html#world-house-landscape-v95'),
      material: movie('home-v95', 'Pixal3D materials on the latest generated house modules.', 'world.html#world-house-landscape-v95'),
      h3: movie('home-h3-v93', 'V93-reviewed H3 film. H3 input: earlier V68 scene geometry.', 'world.html#world-motion-accepted-v93')
    },
    chapters: [[0, 'Build the house'], [9.5, 'Assemble the fence'], [19.12, 'Enter the house'], [27.66, 'Furnish the room'], [37.24, 'Look outside']]
  },
  eras: {
    title: 'One place. Eight eras. A changing world.', duration: 1773 / 24,
    label: '73.9 SECONDS / EIGHT ERAS',
    copy: 'A Japanese settlement evolves from thatched dwellings to temples, castles, townhouses and future towers. Buildings assemble from generated modules while characters and animals move through the changing world.',
    note: 'Gray and material views share the complete V14 geometry, rigs and timeline. The earlier H3 pilot covers a short segment of an older scene; a full-scene H3 render is not available.',
    source: root + 'eras.html#era-evolution',
    views: {
      gray: movie('eras-v14-gray', 'Neutral materials on all eight eras of the same V14 scene.', 'eras.html#era-evolution'),
      material: movie('eras-v14', 'Pixal3D materials on generated buildings, characters and animals.', 'eras.html#era-evolution'),
      h3: { ...missingH3, source: root + 'eras.html#era-evolution' }
    },
    chapters: [[.25, 'Jōmon'], [9.70833, 'Yayoi'], [18.7083, 'Nara'], [27.2917, 'Sengoku'], [35.875, 'Edo'], [45.125, 'Meiji–Taishō'], [55.125, 'Present'], [65.125, 'Future']]
  },
  lakeside: {
    title: 'Build a watermill. Bring its world to life.', duration: 12,
    label: '12 SECONDS / LAKESIDE WATERMILL',
    copy: 'Generated wall, roof and waterwheel parts become a lakeside cottage. Explore the house, turning wheel, bridge and boat from a moving camera, then inspect the geometry behind the materials.',
    note: 'The gray and material views use the same V5 geometry, camera and motion. Scene layout, assembly and animation are authored.',
    source: root + 'lakeside.html#world-stillwater-complete-v5',
    views: {
      gray: movie('lakeside-v5-clay', 'Neutral materials on the same generated modules and animation.', 'lakeside.html#world-stillwater-complete-v5'),
      material: movie('lakeside-v5', 'Pixal3D materials applied to the assembled generated parts.', 'lakeside.html#world-stillwater-complete-v5'),
      h3: { ...missingH3, source: root + 'lakeside.html#world-stillwater-complete-v5' }
    },
    chapters: [[0, 'The lakeside'], [5.5, 'House & waterwheel'], [10.5, 'The other side']]
  },
  space: {
    title: 'From fleet motion to a space battle.', duration: 345 / 24,
    label: '14.4 SECONDS / A CONTINUOUS SPACE BATTLE',
    copy: 'A cruiser and four escorts approach a modular ring station. Generated meshes define the scene and its authored motion; H3 adds crossfire, shields and cinematic detail.',
    note: 'Gray and material views share the V9 geometry, camera and flight paths. The material view now uses Pixal3D textures on the spacecraft as well; the V11 H3 film was rendered earlier from the V9 material video with flat-colored spacecraft. H3 adds visual effects and may reinterpret scene details.',
    source: 'https://alaya-lab.github.io/MeshAxiom/#saga',
    views: {
      gray: movie('space-battle-v9-gray', 'Neutral materials on the same V9 meshes and animation, with effects hidden.', 'https://alaya-lab.github.io/MeshAxiom/#saga'),
      material: movie('space-battle-v9-material-pixal-proj', 'Pixal3D textures on the station modules and spacecraft; the spacecraft also carry their input image projected onto the visible faces. Same V9 geometry, motion and lighting.', 'https://alaya-lab.github.io/MeshAxiom/#saga'),
      h3: { ...movie('space-battle-v11-h3', 'The complete V11 H3 film, rendered from the earlier V9 material video (flat-colored spacecraft). Original audio available.', 'https://alaya-lab.github.io/MeshAxiom/#saga'), audio: true }
    },
    chapters: [[0, 'Cruiser & escorts'], [2, 'Crossfire'], [4, 'Shields & formation'], [10, 'Ring station']]
  },
  dragon: {
    title: 'A single-image creature takes flight.', duration: 12,
    label: '12 SECONDS / THREE-HEADED DRAGON',
    copy: 'A generated three-headed dragon receives Pixal3D materials and an authored 34-bone flight rig. Its wings, necks, tail and limbs move together through takeoff and flight.',
    note: 'Gray and material views preserve the same 4,459 faces, V2 rig, camera and animation. Scene assembly, flight motion and camera are authored.',
    source: 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/hydra/',
    views: {
      gray: movie('hydra-flight-v2-gray', 'Neutral materials on the same V2 mesh, rig and flight scene.', 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/hydra/'),
      material: movie('hydra-flight-v2', 'Pixal3D materials on the same authored 34-bone animation.', 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/hydra/'),
      h3: { ...missingH3, source: 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/hydra/' }
    },
    chapters: [[0, 'Prepare for takeoff'], [2, 'Lift off'], [5, 'Flight'], [9, 'Wings, necks & tail']]
  },
  breakup: {
    title: 'Under fire, the station comes apart.', duration: 297 / 24,
    label: '12.4 SECONDS / A STATION UNDER BOMBARDMENT',
    copy: 'The same generated station modules, now without ships. Its seventeen parts separate in an authored breakup; H3 adds incoming offscreen fire and impact flares.',
    note: 'Gray and material views share the same 17 station parts, breakup motion and camera. The H3 film is rendered from this material video; H3 adds the weapon fire and may reinterpret surface details.',
    views: {
      gray: { file: 'assets/video/station-breakup-gray.mp4', poster: 'assets/images/station-breakup-gray-stage-poster.webp', note: 'Neutral materials on the same modules, breakup motion and camera.' },
      material: { file: 'assets/video/station-breakup-material.mp4', poster: 'assets/images/station-breakup-material-stage-poster.webp', note: 'Pixal3D textures on the station modules; the control video for H3.' },
      h3: { file: 'assets/video/station-breakup-h3.mp4', poster: 'assets/images/station-breakup-h3-stage-poster.webp', note: 'H3 render with offscreen bombardment and impact flares. H3-generated audio available.', audio: true }
    },
    chapters: [[0, 'Intact station'], [4, 'First modules break away'], [8.65, 'Core released'], [10, 'Modules drift apart']]
  }
};
