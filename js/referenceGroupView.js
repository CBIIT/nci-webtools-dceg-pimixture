appMixture.ReferenceGroupsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('references'));
        this.model.on({
            'change:covariatesArr': this.render
        }, this);
        this.setDefaultTypes();
        this.showModal();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'change input[type="number"]': 'updateModel',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    setDefaultTypes: function() {
        var uniqueValues = this.model.get('uniqueValues');
        var covariatesArr = this.model.get('covariatesArr');
        for (var cov of covariatesArr) {
            if (!uniqueValues[cov.text].allNum) {
                cov.type = 'nominal';
            }
        }
    },
    close: function(e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    save: function(e) {
        e.preventDefault(e);
        this.model.get('formModel').set('covariatesArr', this.model.get('covariatesArr'));
        this.model.get('formModel').set('covariatesArrValid', true);
        this.close.call(this, e);
    },
    updateModel: function(e) {
        var model = this.model,
            input = $(e.target),
            covariatesArr = model.get('covariatesArr'),
            name = (input.attr('name') || input.attr('id')).split('_'),
            value = input.val(),
            type = name.splice(name.length-1,1)[0];
        name = name.join('_');

        var covariateObj = _.find(covariatesArr, function (obj) {
            return obj.text === name;
        });
        covariateObj[type] = input.val();
        if (type === 'type') {
            if (value === 'continuous') {
                covariateObj.category = '0';
            } else {
                covariateObj.category = '';
            }
        }
        this.validate();
        model.trigger('change:covariatesArr', model);
    },
    validate: function() {
        var properties = ['text', 'type', 'category'];
        this.model.set('valid', true);
        for (var cov of this.model.get('covariatesArr')) {
            for (var prop of properties) {
                if (!cov[prop]) {
                    this.model.set('valid', false);
                    break;
                }
            }
        }
        this.$('#saveCovariatesBtn').prop('disabled', !this.model.get('valid'));
    },
    render: function() {
        this.$modal.setMessage($(this.template(this.model.attributes)));
    },
    showModal: function() {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                id: 'saveCovariatesBtn',
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Cancel'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Configure Covariates"
        });
        this.setElement(this.$modal.getModal());
        this.validate();
    }
});