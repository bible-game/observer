import { AfterViewInit, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { FoamTree } from "@carrotsearch/foamtree";
import { ConfigService } from './core/service/config.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TitleCasePipe],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.sass'
})
export class AppComponent implements AfterViewInit {
  title = 'observer';
  tree: any;
  config: any;

  // TODO :: play with features / styling...

  constructor(private configService: ConfigService) {}

  async ngAfterViewInit() {
    this.config = await this.configService.getBibleConfig();

    const tree = new FoamTree({
      id: "tree",
      dataObject: this.data,
      layoutByWeightOrder: false,
      stacking: "flattened",
      relaxationInitializer: "order",
      descriptionGroupSize: 0,
      groupBorderWidth: 0,
      groupInsetWidth: 0,
      rectangleAspectRatioPreference: 0
    });
    this.tree = tree;

    window.addEventListener("resize", (function() {
      let timeout: number;
      return function() {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(tree.resize, 300);
      };
    })());
  }

  get data() {
    const testaments: any[] = [];

    for (const test of this.config.testaments) {
      testaments.push({
        id: test.name.toLowerCase(),
        groups: this.getDivisions(test.divisions),
        label: test.name,
        weight: this.getTestamentWeight(test),
      })
    }

    console.log(testaments);
    return { groups: testaments }
  }

  getDivisions(div: any) {
    const divisions: any[] = [];

    for (const d of div) {
      divisions.push({
        id: d.name.toLowerCase().replace(/\s/g, '-'),
        groups: this.getBooks(d.books),
        label: d.name,
        weight: this.getDivisionWeight(d),
      })
    }

    return divisions
  }

  getBooks(bk: any) {
    const books: any[] = [];

    for (const b of bk) {
      books.push({
        id: b.key,
        label: b.name,
        groups: this.getChapters(b, b.chapters),
        weight: this.getBookWeight(b)
      })
    }

    return books
  }

  getChapters(book: any, ch: number) {
    const chapters: any[] = [];

    for (let c = 1; c <= ch; c++) {
      chapters.push({
        id: c.toString(),
        label: c,
        weight: parseFloat(book.verses[c-1])
      })
    }

    return chapters
  }

  getBookWeight(book: any) {
    let weight = 0.0;

    for (const verse of book.verses) {
      weight += verse;
    }

    return weight;
  }

  getDivisionWeight(division: any) {
    let weight = 0.0;

    for (const book of division.books) {
      weight += this.getBookWeight(book);
    }

    return weight;
  }

  getTestamentWeight(testament: any) {
    let weight = 0.0;

    for (const division of testament.divisions) {
      weight += this.getDivisionWeight(division);
    }

    return weight;
  }

}
