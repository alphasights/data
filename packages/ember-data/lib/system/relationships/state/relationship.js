

import {
  OrderedSet
} from "ember-data/system/map";

var Relationship = function(store, record, inverseKey, relationshipMeta) {
  this.members = new OrderedSet();
  this.store = store;
  this.key = relationshipMeta.key;
  this.inverseKey = inverseKey;
  this.record = record;
  this.isAsync = relationshipMeta.options.async;
  this.relationshipMeta = relationshipMeta;
  //This probably breaks for polymorphic relationship in complex scenarios, due to
  //multiple possible typeKeys
  this.inverseKeyForImplicit = this.store.modelFor(this.record.constructor).typeKey + this.key;
  //Cached promise when fetching the relationship from a link
  this.linkPromise = null;
};

Relationship.prototype = {
  constructor: Relationship,

  destroy: Ember.K,

  clear: function() {
    this.members.forEach(function(member) {
      this.removeRecord(member);
    }, this);
  },

  disconnect: function(){
    this.members.forEach(function(member) {
      this.removeRecordFromInverse(member);
    }, this);
  },

  reconnect: function(){
    this.members.forEach(function(member) {
      this.addRecordToInverse(member);
    }, this);
  },

  removeRecords: function(records){
    var that = this;
    records.forEach(function(record){
      that.removeRecord(record);
    });
  },

  addRecords: function(records, idx){
    var that = this;
    records.forEach(function(record){
      that.addRecord(record, idx);
      if (idx !== undefined) {
        idx++;
      }
    });
  },

  serverAddRecords: function(records, idx) {
    for (var i=0; i<records.length; i++) {
      if (idx !== undefined) {
        this.serverAddRecord(records[i], i+idx);
      } else {
        this.serverAddRecord(records[i]);
      }
    }
  },

  serverRemoveRecords: function(records, idx) {
    for (var i=0; i<records.length; i++) {
      if (idx !== undefined) {
        this.serverRemoveRecord(records[i], i+idx);
      } else {
        this.serverRemoveRecord(records[i]);
      }
    }
  },

  serverRemoveRecord: function(record) {
    if (this.members.has(record)) {
      this.removeRecordFromOwn(record);
      if (this.inverseKey) {
        this.removeRecordFromInverse(record);
      } else {
        if (record._implicitRelationships[this.inverseKeyForImplicit]) {
          record._implicitRelationships[this.inverseKeyForImplicit].removeRecord(this.record);
        }
      }
    }
  },

  serverAddRecord: function(record, idx) {
    if (!this.members.has(record)) {
      this.members.add(record);
      this.notifyRecordRelationshipAdded(record, idx);
      if (this.inverseKey) {
        record._relationships[this.inverseKey].addRecord(this.record);
      } else {
        if (!record._implicitRelationships[this.inverseKeyForImplicit]) {
          record._implicitRelationships[this.inverseKeyForImplicit] = new Relationship(this.store, record, this.key,  {options:{}});
        }
        record._implicitRelationships[this.inverseKeyForImplicit].addRecord(this.record);
      }
    }
  },

  addRecord: function(record, idx) {
    if (!this.members.has(record)) {
      this.members.add(record);
      this.notifyRecordRelationshipAdded(record, idx);
      if (this.inverseKey) {
        record._relationships[this.inverseKey].addRecord(this.record);
      } else {
        if (!record._implicitRelationships[this.inverseKeyForImplicit]) {
          record._implicitRelationships[this.inverseKeyForImplicit] = new Relationship(this.store, record, this.key,  {options:{}});
        }
        record._implicitRelationships[this.inverseKeyForImplicit].addRecord(this.record);
      }
      this.record.updateRecordArraysLater();
    }
  },

  removeRecord: function(record) {
    if (this.members.has(record)) {
      this.removeRecordFromOwn(record);
      if (this.inverseKey) {
        this.removeRecordFromInverse(record);
      } else {
        if (record._implicitRelationships[this.inverseKeyForImplicit]) {
          record._implicitRelationships[this.inverseKeyForImplicit].removeRecord(this.record);
        }
      }
    }
  },

  addRecordToInverse: function(record) {
    if (this.inverseKey) {
      record._relationships[this.inverseKey].addRecord(this.record);
    }
  },

  removeRecordFromInverse: function(record) {
    var inverseRelationship = record._relationships[this.inverseKey];
    //Need to check for existence, as the record might unloading at the moment
    if (inverseRelationship) {
      inverseRelationship.removeRecordFromOwn(this.record);
    }
  },

  removeRecordFromOwn: function(record) {
    this.members.delete(record);
    this.notifyRecordRelationshipRemoved(record);
    this.record.updateRecordArrays();
  },

  updateLink: function(link) {
    Ember.assert("You have pushed a record of type '" + this.record.constructor.typeKey + "' with '" + this.key + "' as a link, but the value of that link is not a string.", typeof link === 'string' || link === null);
    if (link !== this.link) {
      this.link = link;
      this.linkPromise = null;
      this.record.notifyPropertyChange(this.key);
    }
  },

  findLink: function() {
    if (this.linkPromise) {
      return this.linkPromise;
    } else {
      var promise = this.fetchLink();
      this.linkPromise = promise;
      return promise.then(function(result) {
        return result;
      });
    }
  },

  updateRecordsFromAdapter: function(records) {
    //TODO Once we have adapter support, we need to handle updated and canonical changes
    this.computeChanges(records);
  },

  notifyRecordRelationshipAdded: Ember.K,
  notifyRecordRelationshipRemoved: Ember.K
};




export default Relationship;
