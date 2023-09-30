import {
  PromiseObject
} from "ember-data/system/promise_proxies";

import Relationship from "ember-data/system/relationships/state/relationship";

var BelongsToRelationship = function(store, record, inverseKey, relationshipMeta) {
  this._super$constructor(store, record, inverseKey, relationshipMeta);
  this.record = record;
  this.key = relationshipMeta.key;
  this.inverseRecord = null;
};

BelongsToRelationship.prototype = Object.create(Relationship.prototype);
BelongsToRelationship.prototype.constructor = BelongsToRelationship;
BelongsToRelationship.prototype._super$constructor = Relationship;

BelongsToRelationship.prototype.setRecord = function(newRecord) {
  if (newRecord) {
    this.addRecord(newRecord);
  } else if (this.inverseRecord) {
    this.removeRecord(this.inverseRecord);
  }
};

BelongsToRelationship.prototype.serverSetRecord = function(newRecord) {
  if (newRecord) {
    this.serverAddRecord(newRecord);
  } else if (this.inverseRecord) {
    this.serverRemoveRecord(this.inverseRecord);
  }
};

BelongsToRelationship.prototype._super$addRecord = Relationship.prototype.addRecord;
BelongsToRelationship.prototype.addRecord = function(newRecord) {
  if (this.members.has(newRecord)){ return;}
  var type = this.relationshipMeta.type;
  Ember.assert("You can only add a '" + type.typeKey + "' record to this relationship", newRecord instanceof type);

  if (this.inverseRecord) {
    this.removeRecord(this.inverseRecord);
  }

  this.inverseRecord = newRecord;
  this._super$addRecord(newRecord);
};

BelongsToRelationship.prototype._super$serverAddRecord = Relationship.prototype.serverAddRecord;
BelongsToRelationship.prototype.serverAddRecord = function(newRecord) {
  if (this.members.has(newRecord)){ return;}
  var type = this.relationshipMeta.type;
  Ember.assert("You can only add a '" + type.typeKey + "' record to this relationship", newRecord instanceof type);

  if (this.inverseRecord) {
    this.removeRecord(this.inverseRecord);
  }

  this.inverseRecord = newRecord;
  this._super$serverAddRecord(newRecord);
};


BelongsToRelationship.prototype.setRecordPromise = function(newPromise) {
  var content = newPromise.get && newPromise.get('content');
  Ember.assert("You passed in a promise that did not originate from an EmberData relationship. You can only pass promises that come from a belongsTo or hasMany relationship to the get call.", content !== undefined);
  this.setRecord(content);
};

BelongsToRelationship.prototype.notifyRecordRelationshipAdded = function(newRecord) {
  this.record.notifyBelongsToAdded(this.key, this);
};

BelongsToRelationship.prototype.notifyRecordRelationshipRemoved = function(record) {
  this.record.notifyBelongsToRemoved(this.key, this);
};

BelongsToRelationship.prototype._super$removeRecordFromOwn = Relationship.prototype.removeRecordFromOwn;
BelongsToRelationship.prototype.removeRecordFromOwn = function(record) {
  if (!this.members.has(record)){ return;}
  this._super$removeRecordFromOwn(record);
  this.inverseRecord = null;
};

BelongsToRelationship.prototype.findRecord = function() {
  if (this.inverseRecord) {
    return this.store._findByRecord(this.inverseRecord);
  } else {
    return Ember.RSVP.Promise.resolve(null);
  }
};

BelongsToRelationship.prototype.fetchLink = function() {
  var self = this;
  return this.store.findBelongsTo(this.record, this.link, this.relationshipMeta).then(function(record){
    self.addRecord(record);
    return record;
  });
};

BelongsToRelationship.prototype.getRecord = function() {
  if (this.isAsync) {
    var promise;
    if (this.link){
      var self = this;
      promise = this.findLink().then(function() {
        return self.findRecord();
      });
    } else {
      promise = this.findRecord();
    }

    return PromiseObject.create({
      promise: promise,
      content: this.inverseRecord
    });
  } else {
    Ember.assert("You looked up the '" + this.key + "' relationship on a '" + this.record.constructor.typeKey + "' with id " + this.record.get('id') +  " but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async (`DS.belongsTo({ async: true })`)", this.inverseRecord === null || !this.inverseRecord.get('isEmpty'));
    return this.inverseRecord;
  }
};

export default BelongsToRelationship;
