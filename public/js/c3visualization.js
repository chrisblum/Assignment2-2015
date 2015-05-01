(function() {
  $.getJSON( '/igMediaCounts')
    .done(function( data ) {
      var yCounts = data.users.map(function(item){
        // if (item.counts.followed_by > 50000) {
        //   return 50000;
        // }
        // else {

        return item.counts.followed_by;
      // }
      });
      var xCounts = data.users.map(function(item){
        return item.counts.follows;
      });
      
      yCounts.unshift('Follower Count');
      xCounts.unshift('Follow Count');

      var chart = c3.generate({
        bindto: '#chart',
        data: {
          columns: [
            yCounts,
            xCounts
          ],
          type: 'area'

        },
        size: {
            height:500
          },
        onmouseover: function () {
            chart.axis.max(1000000);
          },
        onmouseout: function() {
            chart.axis.max(7500);
          }
      });


      setTimeout(function () {
    chart.axis.max(1000000);
}, 1000);


      setTimeout(function () {
    chart.axis.max(7500);
}, 2000);


    });
})();
