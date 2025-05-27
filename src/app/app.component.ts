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
      descriptionGroupType: "floating",
      descriptionGroupMinHeight: 64,
      descriptionGroupMaxHeight: 0.25,
      groupBorderWidth: 0,
      groupBorderRadius: 0,
      groupInsetWidth: 6,
      groupLabelMinFontSize: 0,
      groupLabelMaxFontSize: 16,
      rectangleAspectRatioPreference: 0,
      groupLabelDarkColor: "#98a7d8",
      groupLabelLightColor: "#060842",
      groupLabelColorThreshold: 0.75,
      parentFillOpacity: 0,
      groupColorDecorator: function (opts: any, params: any, vars: any) {
        vars.groupColor = params.group.color;
        vars.labelColor = "auto";
      },
      groupFillType: "plain"
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
        weight: this.getBookWeight(b),
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
        weight: parseFloat(book.verses[c-1]),
        color: this.getColour(book.key)
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

  getColour(book: string): any {
    const colour: any = {
      "GEN": "#36ABFF",
      "EXO": "#36ABFF",
      "LEV": "#36ABFF",
      "NUM": "#36ABFF",
      "DEU": "#36ABFF",

      "JOS": "#8967F6",
      "JDG": "#8967F6",
      "RUT": "#8967F6",
      "1SA": "#8967F6",
      "2SA": "#8967F6",
      "1KI": "#8967F6",
      "2KI": "#8967F6",
      "1CH": "#8967F6",
      "2CH": "#8967F6",
      "EZR": "#8967F6",
      "NEH": "#8967F6",
      "EST": "#8967F6",

      "JOB": "#C54A84",
      "PSA": "#C54A84",
      "PRO": "#C54A84",
      "ECC": "#C54A84",
      "SNG": "#C54A84",

      "ISA": "#4DBA7E",
      "JER": "#4DBA7E",
      "LAM": "#4DBA7E",
      "EZK": "#4DBA7E",
      "DAN": "#4DBA7E",

      "HOS": "#D0B42B",
      "JOL": "#D0B42B",
      "AMO": "#D0B42B",
      "OBA": "#D0B42B",
      "JON": "#D0B42B",
      "MIC": "#D0B42B",
      "NAM": "#D0B42B",
      "HAB": "#D0B42B",
      "ZEP": "#D0B42B",
      "HAG": "#D0B42B",
      "ZEC": "#D0B42B",
      "MAL": "#D0B42B",

      "MAT": "#D0B42B",
      "MRK": "#D0B42B",
      "LUK": "#D0B42B",
      "JHN": "#D0B42B",

      "ACT": "#4DBA7E",

      "ROM": "#36ABFF",
      "1CO": "#36ABFF",
      "2CO": "#36ABFF",
      "GAL": "#36ABFF",
      "EPH": "#36ABFF",
      "PHP": "#36ABFF",
      "COL": "#36ABFF",
      "1TH": "#36ABFF",
      "2TH": "#36ABFF",
      "1TI": "#36ABFF",
      "2TI": "#36ABFF",
      "TIT": "#36ABFF",
      "PHM": "#36ABFF",
      "HEB": "#36ABFF",

      "JAS": "#C54A84",
      "1PE": "#C54A84",
      "2PE": "#C54A84",
      "1JN": "#C54A84",
      "2JN": "#C54A84",
      "3JN": "#C54A84",
      "JUD": "#C54A84",

      "REV": "#8967F6"
    }

    return colour[book];
  }

}
