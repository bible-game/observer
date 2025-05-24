import { Component, Injectable, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import "d3-weighted-voronoi";
import "d3-voronoi-map";
import data from "./data.json";
import { Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable()
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TitleCasePipe],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.sass'
})
export class AppComponent implements OnInit {
  title = 'observer';
  height = 500;
  width = 960;
  halfWidth = this.width / 2;
  halfHeight = this.height / 2;
  radius = Math.min(this.halfWidth, this.halfHeight);

  voronoiTreemap: any;
  hierarchy: any;
  circlingPolygon: any;
  svg: any;
  drawingArea: any;
  treemapContainer: any;
  fontScale = d3.scaleLinear();

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit() {
    this.voronoiTreemap = voronoiTreemap();
    this.initData();
    this.initLayout();
    this.hierarchy = d3.hierarchy({ children: data }).sum((d: any) => d.votes);
    this.voronoiTreemap.clip(this.circlingPolygon)(this.hierarchy);

    this.drawTreemap(this.hierarchy);
  }

  initData() {
    this.circlingPolygon = this.computeCirclingPolygon();
    this.fontScale.domain([3, 20]).range([8, 20]).clamp(true);
  }

  computeCirclingPolygon() {
    return [
      [0, 0],
      [this.width, 0],
      [this.width, this.height],
      [0, this.height]
    ];
  }

  initLayout() {
    this.svg = d3.select(this.document).select("svg").attr("width", this.width).attr("height", this.height);
    this.drawingArea = this.svg.append("g").classed("drawingArea", true);
    this.treemapContainer = this.drawingArea.append("g").classed("treemap-container", true);

    this.treemapContainer
      .append("path")
      .classed("world", true)
      .attr("transform", `translate(${-this.radius}, ${-this.radius})`)
      .attr("d", `M${this.circlingPolygon.join(",")}Z`);
  }

  drawTreemap(hierarchy: any) {
    const leaves = hierarchy.leaves();

    this.treemapContainer
      .append("g")
      .classed("cells", true)
      .selectAll(".cell")
      .data(leaves)
      .enter()
      .append("path")
      .classed("cell", true)
      .style("stroke", "white")
      .attr("d", (d: any) => `M${d.polygon.join(",")}z`);

    const labels = this.treemapContainer
      .append("g")
      .classed("labels", true)
      .selectAll(".label")
      .data(leaves)
      .enter()
      .append("g")
      .classed("label", true)
      .attr(
        "transform",
        (d: any) => `translate(${d.polygon.site.x}, ${d.polygon.site.y})`
      )
      .style("font-size", (d: any) => this.fontScale(d.data.votes));

    labels
      .append("text")
      .classed("name", true)
      .style("fill", "blue")
      .text((d: any) => d.data.term);
    // labels
    //   .append("text")
    //   .classed("value", true)
    //   .style("fill", "white")
    //   .text((d: any) => `${d.data.votes}%`);
  }

}
