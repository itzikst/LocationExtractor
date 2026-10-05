Go over all of the point (exclude regions) locations that were extracted, and compute their coordinates. using the following sources by order of quality:
- some of the locations have exact coordinates (new/old Israel Grid) in the disertation. use those. 
- for locations where the dissertation doesn't have coordinates, use the IAA site as a source of additional information about the locations. note that possible spelling variations exist
- in case that both sources do not have the coordinates, use the internet to find the coordinates. use sources such as wikipedia, google maps, etc. 
- the output should be a csv table, with the following columns:
- name, coordinates, source (PhD, IAA, URL of Web Source), number of possible geocodes, best-candidate (boolean)
- in case there are multiple geocodes for a location (e.g. from IAA/web search) keep all the candidates, and select one as Best candidate, based on PhD context.
