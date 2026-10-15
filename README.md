# MeshAxiom: An Agent-Native 3D Foundation Stack for Programmable Worlds

[Yonghao Yu](https://scholar.google.com/citations?user=lwuwuAYAAAAJ) · [Ruihan Yu](https://auroraryan0301.github.io/) · [Sho Kuno](https://shokuno5.github.io/) · [Muyao Niu](https://myniuuu.github.io/) · [Yu-Ju Tsai](https://liagm.github.io/) · [Zheng-Hui Huang](https://brian90709.github.io/) · [Fengbo Lan](https://openreview.net/profile?id=%7EFengbo_Lan1) · [Guixu Lin](https://www.researchgate.net/profile/Guixu_Lin) · [Runyi Li](https://lirunyi2001.github.io/) · [Chuanhao Li](https://nevermorelch.github.io/) · [Ming-Hsuan Yang](https://faculty.ucmerced.edu/mhyang/) · [Kaipeng Zhang](https://kpzhang93.github.io/) · [Zhixiang Wang](https://lightchaserx.github.io/)

MeshAxiom connects single-image geometry generation to compact explicit meshes, file-based tools, reusable asset records and scene programs. Its geometry backend, MeshAxiom-Base, accepts an image and a requested face budget; tools expose the resulting vertices, triangles and views for inspection and editing.

[Project Page](https://alaya-lab.github.io/MeshAxiom/) · [Asset Library](https://alaya-lab.github.io/MeshAxiom/space-kit.html) · [Code](https://github.com/AlayaLab/MeshAxiom) · [Hugging Face](https://huggingface.co/AlayaLab)

Explore 123 generated assets, nineteen assemblies and twelve animated scenes. Geometry and material views preserve the same scene state. The showcase includes selected meshes, bounded repairs, external materials and authored layouts, rigs and motion; optional H3 restyling is shown separately.

This repository contains the static project website and asset-library page. Existing media, interactive viewers and styles continue to use the public showcase asset host. Model weights, training code and workflow tools are planned releases.

The site is served directly from the repository root with GitHub Pages; `.nojekyll` preserves static asset handling. The document base points to the existing showcase host to keep shared media and viewer dependencies available, while canonical, navigation, social-image and project-owned script URLs use the MeshAxiom project path.
