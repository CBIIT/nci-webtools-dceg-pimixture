appMixture.InteractiveEffectsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('effects'));
        this.model.on({
            'change:effects': this.rerenderFooter,
            'change:first': this.rerenderSelects,
            'change:second': this.rerenderSelects
        }, this);
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'click #add-effects': 'addEffect',
        'click .remove-effects': 'removeEffect',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    addEffect: function (e) {
        var model = this.model,
            first = model.get('first'),
            second = model.get('second'),
            effects = model.get('effects');
        effects.push({
            'first': first < second ? first : second,
            'second': first < second ? second : first
        });
        model.set({
            'first': '',
            'second': ''
        });
        model.trigger('change:effects', model);
    },
    close: function (e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    removeEffect: function (e) {
        var effects = this.model.get('effects');
        effects.splice(parseInt(e.currentTarget.dataset.index), 1);
        this.model.trigger('change:effects', this.model);
    },
    save: function (e) {
        e.preventDefault(e);
        this.model.get('formModel').set('effects', this.model.get('effects'));
        this.close.call(this, e);
    },
    updateModel: appMixture.events.updateModel,
    render: function () {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Close'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Enter Interactive Effects"
        });
        this.setElement(this.$modal.getModal());
        this.rerenderSelects.apply(this);
        this.rerenderFooter.apply(this);
    },
    rerenderSelects: function () {
        var model = this.model,
            effects = model.get('effects'),
            first = model.get('first'),
            second = model.get('second'),
            firstList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== second;
            }),
            secondList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== first;
            }),
            eF = this.$el.find('[name="first"]'),
            eS = this.$el.find('[name="second"]'),
            selectedIndex = 0;
        eF.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        firstList.forEach(function (entry, index) {
            if (entry === first) selectedIndex = index + 1;
            eF.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eF[0].selectedIndex = selectedIndex;
        selectedIndex = 0;
        eS.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        secondList.forEach(function (entry, index) {
            if (entry === second) selectedIndex = index + 1;
            eS.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eS[0].selectedIndex = selectedIndex;
        first = this.model.get('first');
        second = this.model.get('second');
        var alreadyInserted = effects.length > 0 ? effects.filter(function (entry) {
            return entry.first == (first < second ? first : second) && entry.second == (first < second ? second : first);
        }).length > 0 : false;
        if (first === '' || second === '' || alreadyInserted) {
            this.$('#add-effects').prop('disabled', true);
        } else {
            this.$('#add-effects').prop('disabled', false);
        }
    },
    rerenderFooter: function () {
        this.$el.find('tbody').empty().append(_.template(appMixture.templates.get('effectsFooter'))(this.model.attributes));
    }
});