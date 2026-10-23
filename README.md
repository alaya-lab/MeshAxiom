# MeshAxiom: An Agent-Native 3D Foundation Stack for Programmable Worlds

[Yonghao Yu](https://scholar.google.com/citations?user=lwuwuAYAAAAJ) · [Ruihan Yu](https://auroraryan0301.github.io/) · [Sho Kuno](https://shokuno5.github.io/) · [Muyao Niu](https://myniuuu.github.io/) · [Yu-Ju Tsai](https://liagm.github.io/) · [Zheng-Hui Huang](https://brian90709.github.io/) · [Fengbo Lan](https://openreview.net/profile?id=%7EFengbo_Lan1) · [Guixu Lin](https://www.researchgate.net/profile/Guixu_Lin) · [Runyi Li](https://lirunyi2001.github.io/) · [Chuanhao Li](https://nevermorelch.github.io/) · [Ming-Hsuan Yang](https://faculty.ucmerced.edu/mhyang/) · [Kaipeng Zhang](https://kpzhang93.github.io/) · [Zhixiang Wang](https://lightchaserx.github.io/)

MeshAxiom connects single-image geometry generation to compact explicit meshes, file-based tools, reusable asset records and scene programs. Its geometry backend, MeshAxiom-Base, accepts an image and a requested face budget; tools expose the resulting vertices, triangles and views for inspection and editing.

[Project Page](https://alaya-lab.github.io/MeshAxiom/) · [Asset Library](https://alaya-lab.github.io/MeshAxiom/space-kit.html) · [Code](https://github.com/AlayaLab/MeshAxiom) · [Hugging Face](https://huggingface.co/AlayaLab/MeshAxiom-Base)

Explore 123 generated assets, nineteen assemblies and twelve animated scenes. Geometry and material views preserve the same scene state. The showcase includes selected meshes, bounded repairs, external materials and authored layouts, rigs and motion; optional H3 restyling is shown separately.

This repository contains the static project website, asset-library page, application scripts, styles and JSON data. Models, videos, images and fonts are distributed through the [MeshAxiom Project Assets repository](https://huggingface.co/datasets/AlayaLab/MeshAxiom-Assets). The [MeshAxiom-Base model weights](https://huggingface.co/AlayaLab/MeshAxiom-Base) are publicly available. Training code and workflow tools are planned releases.

The site is served directly from the repository root with GitHub Pages; `.nojekyll` preserves static asset handling. Shared viewers and data are included under `alayacrafter/` and `alaya-kit/`. `asset-url.js` maps known binary resources to Hugging Face dataset revision `37cc2e36e3679c4f819da1488afbe61eec442e9e`; project navigation and source-page aliases stay within the official GitHub Pages project.
