# Evenly spaced wind map

This is just a demo for the [streamlines](https://github.com/anvaka/streamlines) library.

This repository uses vector field of the wind data to draw streamlines.

# Data source

The data was collected from http://nomads.ncep.noaa.gov/ using this [tool](https://github.com/mapbox/webgl-wind/blob/master/data/download.sh).

# Visualization

Wind data can be treated as a vector field - we assign a vector to every single point on the map.

If you want to visualize this vector field, you can drop thousands of particles, and treat each vector
as a velocity vector. The particles flow will give you intuition of how this field "looks".

Streamlines is another way to visualize a vector field. Instead of having random particles flowing in
the field, we preserve a path that each particle has went through.

We could randomly sample points on a vector field and trace their paths, but that may give not very nice
looking pictures (as density of the lines will be different in different places).

See the difference below:

![difference](https://i.imgur.com/H55ojsq.png)

This image is taken from a paper by [Bruno Jobard and Wilfrid Lefer](http://web.cs.ucdavis.edu/~ma/SIGGRAPH02/course23/notes/papers/Jobard.pdf).

The [streamlines](https://github.com/anvaka/streamlines) library is my attempt to implement the algorithm
described by Jobard and Lefer. Please follow the link to [anvaka/streamlines](https://github.com/anvaka/streamlines) to
learn more.

This repository is a small wrapper on top of the streamlines library, that has everything implemented in just one file.
The biggest challenge here was to come up with good streamline density and implement animation.

## See also

* If you haven't seen this yet, please check out this amazing [webgl wind demo](https://mapbox.github.io/webgl-wind/demo/) and
a [satellite article](https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f) by @mourner. It is well written
and can be used as study material for WebGL/vector fields programming.
* [fieldplay](https://anvaka.github.io/fieldplay/) - WebGL powered vector field editor.
* [streamlines demo](https://anvaka.github.io/streamlines/) - canvas based demo for the streamlines library.

# License
MIT