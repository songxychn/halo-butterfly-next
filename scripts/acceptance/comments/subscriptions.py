def rotating_subscription(obj, subject, preserve_existing_reply=False):
    spec = obj['spec']
    reason = spec.get('reason', {})
    expected = {'new-comment-on-post': "props.postOwner == 'fixture-maintainer'"}
    if subject == 'Moment': expected['new-comment-on-moment'] = "props.momentOwner == 'fixture-maintainer'"
    if subject == 'SinglePage': expected['new-comment-on-single-page'] = "props.pageOwner == 'fixture-maintainer'"
    if preserve_existing_reply: expected['someone-replied-to-you'] = "props.repliedOwner == 'fixture-maintainer'"
    return (set(spec) == {'disabled', 'reason', 'subscriber', 'unsubscribeToken'}
            and spec['disabled'] is False
            and spec['subscriber'] == {'name': 'fixture-maintainer'}
            and reason.get('reasonType') in expected
            and reason == {'reasonType': reason['reasonType'], 'expression': expected[reason['reasonType']], 'subject': {'apiVersion': 'notification.halo.run/v1alpha1', 'kind': 'NonexistentKind'}}
            and isinstance(spec['unsubscribeToken'], str) and bool(spec['unsubscribeToken']))
