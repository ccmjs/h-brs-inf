/**
 * @overview ccmjs-based web component for multiple choice analytics
 * @author André Kless <andre.kless@web.de> 2021
 * @license The MIT License (MIT)
 * @version latest (1.0.0)
 * @changes
 * version 1.0.0 (25.04.2021)
 */

( () => {

  const component = {
    name: 'mc_analytics',
    ccm: 'https://ccmjs.github.io/ccm/versions/ccm-26.3.0.js',
    config: {
      "chart": [ "ccm.component", "https://ccmjs.github.io/akless-components/highchart/versions/ccm.highchart-3.0.3.js" ],
      "css": [ "ccm.load",
        [  // serial
          "https://ccmjs.github.io/akless-components/libs/bootstrap-4/css/bootstrap.min.css",
          "https://ccmjs.github.io/h-brs-inf/mc_analytics/resources/styles.css"
        ]
      ],
      "data": {},
      "helper": [ "ccm.load", "https://ccmjs.github.io/akless-components/modules/versions/helper-7.2.0.mjs" ],
      "html": [ "ccm.load", "https://ccmjs.github.io/h-brs-inf/mc_analytics/resources/templates.mjs" ],
      "modal": [ "ccm.start", "https://ccmjs.github.io/tkless-components/modal/versions/ccm.modal-3.0.0.js", {
        "backdrop_close": true,
        "buttons": null,
        "closed": true,
        "content": "",
        "title": ""
      } ],
//    "onstart": instance => { ... }
    },

    Instance: function () {

      let $, dataset, questions;

      this.start = async () => {

        // set shortcut to help functions
        $ = Object.assign( {}, this.ccm.helper, this.helper ); $.use( this.ccm );

        // render main HTML structure
        $.setContent( this.element, $.html( this.html.main, () => { $.setContent( this.element.querySelector( '#refresh' ), $.loading( this ) ); this.start(); } ) );

        // get data
        dataset = await $.dataset( this.data );

        // no data? => nothing to display
        if ( !dataset ) return $.setContent( this.element.querySelector( '#data' ), '<span class="p-3">No data to display.</span>' );

        // get question-focused data
        questions = toQuestions( dataset );

        // render analytics data
        this.html.render( this.html.table( questions ), this.element.querySelector( '#data' ) );

        // set click events for diagram buttons
        this.element.querySelectorAll( '.question' ).forEach( row => row.querySelector( 'button' ).addEventListener( 'click', () => showQuestionChart( row.dataset.key ) ) );
        this.element.querySelector( '#points-chart' ).addEventListener( 'click', showPointsChart );

        // trigger 'onstart' callback
        this.onstart && await this.onstart( this );

      };

      /**
       * returns the visualized data
       * @returns {Object}
       */
      this.getValue = () => $.clone( questions );

      /**
       * converts the user-focused data to question-focused data
       * @returns {Object} questions focused-data
       */
      const toQuestions = users => {
        const questions = {};
        Object.values( users ).forEach( user => {
          user.sections.forEach( section => {
            let question = questions[ section.key ];
            if ( !question ) {
              question = {
                key: section.key,
                title: section.title,
                answers: {},
                correct: 0,
                total: 0,
                points: {
                  average: 0
                }
              };
              section.parts.forEach( part => question.answers[ part.key ] = {
                key: part.key,
                text: part.text,
                solution: part.solution,
                inputs: [],
                correct: 0,
                total: 0
              } );
              questions[ section.key ] = question;
            }
            let correct_answers = 0;
            section.parts.forEach( part => {
              const answer = question.answers[ part.key ];
              const input = {
                key: user.key,
                name: user.name,
                input: part.input,
                correct: part.input === answer.solution
              };
              answer.inputs[ user.key ] = input;
              input.correct && ++answer.correct && ++correct_answers;
              answer.total++;
            } );
            correct_answers === section.parts.length && question.correct++;
            question.total++;
            let points = 2 * correct_answers - section.parts.length;
            if ( points < 0 ) points = 0;
            if ( question.points.min === undefined || points < question.points.min ) question.points.min = points;
            if ( question.points.max === undefined || points > question.points.max ) question.points.max = points;
            question.points.average += points;
          } );
        } );
        Object.values( questions ).forEach( question => question.points.average = question.points.average / question.total );
        return questions;
      };

      /** shows the question data as a chart in a modal dialog */
      const showQuestionChart = question => {
        const content = this.modal.element.querySelector( '#content' );
        $.setContent( content, $.loading( this ) );
        this.modal.open();
        question = questions[ question ];
        const answers = Object.values( question.answers );
        const categories = [ 'A1', 'A2', 'A3', 'A4', 'A5' ];
        this.chart.start( {
          root: content,
          settings: {
            chart: {
              type: 'column'
            },
            title: {
              text: question.title
            },
            subtitle: {
              text: `Beantwortet von insgesamt ${question.total} Studierenden.`
            },
            xAxis: [
              {
                categories: categories
              },
              {
                opposite: true,
                reversed: false,
                categories: categories.map( ( _, i) => `<span style="color:${answers[i].solution?'green':'red'}">•</span>` ),
                linkedTo: 0
              }
            ],
            yAxis: {
              title: {
                text: 'Anzahl Studierende'
              },
              labels: {
                formatter: function () {
                  return Math.abs( this.value );
                }
              }
            },
            plotOptions: {
              series: {
                borderWidth: 0,
                dataLabels: {
                  enabled: true,
                  formatter: function () {
                    return Math.abs( this.point.y );
                  }
                },
                stacking: 'normal'
              }
            },
            tooltip: {
              formatter: function () {
                return `<b>${ this.point.category }</b> wurde von <b>${ Math.abs( this.point.y ) }</b> Studierenden <b>${ this.series.name }</b>.<br>${ answers[ this.point.index ].text }`;
              }
            },
            series: [
              {
                name: 'richtig angekreuzt',
                data: answers.map( answer => answer.correct ),
                color: 'limegreen'
              },
              {
                name: 'falsch angekreuzt',
                data: answers.map( answer => answer.correct - answer.total ),
                color: 'red'
              }
            ]
          }
        } );

      };

      /** shows the average number of points achieved for each question in a modal dialog */
      const showPointsChart = () => {
        const data = Object.values( questions );
        const content = this.modal.element.querySelector( '#content' );
        $.setContent( content, $.loading( this ) );
        this.modal.open();
        this.chart.start( {
          root: content,
          settings: {
            chart: {
              type: 'column'
            },
            title: {
              text: 'Durchschnittlich erreichte Punktzahl'
            },
            xAxis: {
              categories: data.map( question => question.title.split( ' ' )[ 0 ] ),
              title: {
                text: "MC Fragen"
              }
            },
            yAxis: {
              title: {
                text: 'Erreichte Punktzahl'
              }
            },
            tooltip: {
              valueSuffix: ' Punkte'
            },
            plotOptions: {
              column: {
                dataLabels: {
                  enabled: true,
                  formatter: function () {
                    return this.point.y % 1 !== 0 ? Math.round( this.point.y * 10 ) / 10 : this.point.y;
                  }
                }
              }
            },
            series: [
              {
                name: 'Minimum',
                data: data.map( question => question.points.min ),
                color: 'red'
              },
              {
                name: 'Durschnitt',
                data: data.map( question => question.points.average ),
                color: 'blue'
              },
              {
                name: 'Maximum',
                data: data.map( question => question.points.max ),
                color: 'limegreen'
              }
            ]
          }
        } );

      };

    }
  };

  let b="ccm."+component.name+(component.version?"-"+component.version.join("."):"")+".js";if(window.ccm&&null===window.ccm.files[b])return window.ccm.files[b]=component;(b=window.ccm&&window.ccm.components[component.name])&&b.ccm&&(component.ccm=b.ccm);"string"===typeof component.ccm&&(component.ccm={url:component.ccm});let c=(component.ccm.url.match(/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)||[""])[0];if(window.ccm&&window.ccm[c])window.ccm[c].component(component);else{var a=document.createElement("script");document.head.appendChild(a);component.ccm.integrity&&a.setAttribute("integrity",component.ccm.integrity);component.ccm.crossorigin&&a.setAttribute("crossorigin",component.ccm.crossorigin);a.onload=function(){(c="latest"?window.ccm:window.ccm[c]).component(component);document.head.removeChild(a)};a.src=component.ccm.url}
} )();