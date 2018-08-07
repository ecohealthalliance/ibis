import { ReactiveVar } from 'meteor/reactive-var';

Template.timeline.onCreated(function() {
  this.timelineType = new ReactiveVar({activeCases: true});
});

Template.timeline.onRendered(function() {
  this.autorun(() => {
    const curTimelineType = this.timelineType.get();
    const startDateStr = this.data.dateRange.start.toISOString().split('T')[0];
    const endDateStr = this.data.dateRange.end.toISOString().split('T')[0];
    var timeseries = this.data.resolvedBioevent.timeseries;
    const timelineMax = this.data.max || _.max(timeseries.map((x) => x[1]));
    if(curTimelineType.newCases) {
      timeseries = this.data.resolvedBioevent.dailyRateTimeseries.reduce((sofar, [date, value]) => {
        if(sofar.length > 0) {
          const prev = sofar.slice(-1)[0];
          return sofar.concat([
            [prev[0], value],
            [date, value]
          ]);
        } else {
          return [[date, value]];
        }
      }, []);
    }
    let formattedTimeseries = timeseries.map(([date, value], idx) => {
      // The date is slightly perturbed to ensure that it always increasing.
      // Equal dates can cause errors in the plot.
      return {
        date: Number(new Date(date)) + idx,
        value: value
      };
    });
    const formatNumber = (x) => {
      const value = Math.pow(10, x) - 1;
      if(value >= 1000) {
        return value.toPrecision(1);
      } else {
        return value.toFixed(0);
      }
    };
    const dayBeforeEndStr = new Date(
      new Date(this.data.dateRange.end).setDate(this.data.dateRange.end.getDate() - 1)
    ).toISOString().split('T')[0];
    const chart = c3.generate({
      bindto: this.$('.timeline')[0],
      padding: {
        right: 20,
        left: 40,
        top: 10
      },
      data: {
        json: formattedTimeseries.map((x) => {
          x = Object.create(x);
          x.value = Math.log10(1 + x.value);
          return x;
        }),
        keys: {
          x: 'date',
          value: ['value'],
        },
        type: 'area',
        color: () => '#ffffff',
        labels : {
          show: true,
          format: {
            data1: formatNumber
          }
        }
      },
      axis: {
        x: {
          min: startDateStr,
          max: endDateStr,
          tick: {
            // The final tick is the day before the right bound so the label
            // fits.
            values: [new Date(startDateStr), new Date(dayBeforeEndStr)],
            format: (x)=> new Date(x).toISOString().split('T')[0]
          },
          type: 'timeseries',
          show: true
        },
        y: {
          min: 0,
          max: Math.log10(timelineMax),
          tick: {
            values: [0, Math.log10(timelineMax) / 2, Math.log10(timelineMax)],
            format: formatNumber
          },
          show: true
        }
      },
      legend: {
        show: false
      }
    });
  });
});

Template.timeline.helpers({
  type: () => {
    return Template.instance().timelineType.get();
  }
});

Template.timeline.events({
  'click .timeline-type': (event, instance) => {
    const timelineType = $(event.target).data('timeline-type');
    instance.timelineType.set({
      newCases: timelineType == "newCases",
      activeCases: timelineType == "activeCases"
    });
  }
});
