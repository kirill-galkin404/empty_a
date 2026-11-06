app.filter('fromNow', function () {
  return function (date) {
    if (!date) return '';
    return moment(date).fromNow();
  };
});

app.filter('prettyDate', function () {
  return function (date) {
    if (!date) return '';
    return moment(date).format('MMM D, YYYY');
  };
});

app.filter('priorityLabel', function () {
  return function (p) {
    if (p == 3) return 'High';
    if (p == 2) return 'Normal';
    if (p == 1) return 'Low';
    return '?';
  };
});
