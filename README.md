# Snooker Rating

> English | [简体中文](README.zh-CN.md)

[Open the Snooker Rating website](https://junjiecharles.github.io/snooker-rating/)

Snooker Rating is an independent view of professional players' playing strength over time. It is designed to support:

- comparing current player strength;
- exploring how a player's level has changed throughout their career;
- reviewing historical rankings at selected World Championship endpoints;
- comparing two players' rating histories and match records.

The rating is a statistical estimate, not the official World Snooker Tour ranking and not a measure of prize money. It should be read as evidence about relative playing strength within the matches covered by the site. Ratings for players with limited or old match data are naturally less certain, and historical estimates may change when results are added or corrected.

## Rating method

The site uses Rémi Coulom's **Whole-History Rating (WHR)** method. WHR is well suited to showing strength over time while using the complete available match history. The implementation records its data cutoff, parameters, algorithm version, and inclusion scope so that published rankings remain traceable and reproducible.

This README intentionally gives only a user-level description. For background on the method, see the references below.

## References

- [Whole-History Rating project page](https://www.remi-coulom.fr/WHR/)
- [Whole-History Rating paper](https://www.remi-coulom.fr/WHR/WHR.pdf)

## Repository scope and licensing

This branch is a deployment snapshot containing the browser frontend and generated static data for the live website. The private data pipeline, rating implementation, refresh workflow, and reporting tools are not included.

The frontend code in the root `*.html` files, `package.json`, `assets/*.js`, and `assets/*.css` is licensed under the MIT License in [`LICENSE-CODE`](LICENSE-CODE). No license is currently granted for `data/**`, the Snooker Rating logos, or other image and vector assets; those files are publicly readable for operating the website but are not covered by the MIT License.
