const { Temporal } = require('@js-joda/core');

Temporal.prototype.isBeforeOrEqual = function (other) {
    return this.isBefore(other) || this.equals(other);
};

Temporal.prototype.isAfterOrEqual = function (other) {
    return this.isAfter(other) || this.equals(other);
};
