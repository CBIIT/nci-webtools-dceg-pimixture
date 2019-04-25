from flask import Flask, send_file, send_from_directory, jsonify, request, abort
from sqs import *

app = Flask(__name__)

# Return list of dicts like
# {
#   'tie': 'dev'
#   'name': 'pimixture.fifo'
# }
#
def getQueueNames(product):
    tiers = ['dev', 'qa']
    queue_names = {
        'pimixture.dev': 'pimixture.fifo',
        'pimixture.qa': 'pimixture2.fifo',
        'microarray.dev': 'microarray.fifo'
    }

    names = []

    for tier in tiers:
        key = '{}.{}'.format(product.lower(), tier.lower())
        if key in queue_names:
            names.append({'tier': tier, 'name': queue_names[key]})
    return names

@app.route('/')
def main():
    return send_file('./index.html')

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('js', path)

@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('css', path)

@app.route('/queryStatus')
def queryStatus():
    print('Query Status')
    product = request.args.get('product')
    if product:
        results = []
        print('product: {}'.format(product))
        queue_names = getQueueNames(product)
        for queue in queue_names:
            q = Queue(queue['name'])
            avl = q.getNumberOfAvailableMessages()
            inflight = q.getNumberOfInFlightMessages()
            results.append({'tier': queue['tier'], 'queue_name': queue['name'], 'avl': avl, 'inflt': inflight})
        return jsonify(results)
    else:
        return abort(400)


if __name__ == '__main__':
    app.run()
