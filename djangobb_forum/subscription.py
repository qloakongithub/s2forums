from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.core.urlresolvers import reverse
from django.utils.html import strip_tags
from celery.decorators import task

from djangobb_forum import settings as forum_settings
from djangobb_forum.util import absolute_url
from djangobb_forum.models import Post

from scratchr2.notifications.models import SocialAction


if "mailer" in settings.INSTALLED_APPS:
    from mailer import send_mail
else:
    from django.core.mail import send_mail
    def send_mail(subject, text, from_email, rec_list, html=None):
        """
        Shortcut for sending email.
        """
    
        msg = EmailMultiAlternatives(subject, text, from_email, rec_list)
        if html:
            msg.attach_alternative(html, "text/html")
        if forum_settings.EMAIL_DEBUG:
            print '---begin---'
            print 'To:', rec_list
            print 'Subject:', subject
            print 'Body:', text
            print '---end---'
        else:
            msg.send(fail_silently=True)


# TODO: move to txt template
TOPIC_SUBSCRIPTION_TEXT_TEMPLATE = (u"""New reply from %(username)s to topic that you have subscribed on.
---
%(message)s
---
See topic: %(post_url)s
Unsubscribe %(unsubscribe_url)s""")


def notify_topic_subscribers(post):
    # notify users asynchronously
    scratch_notify_topic_subscribers.delay(post.id)
    # debug version:
    # scratch_notify_topic_subscribers(post.id)

def email_topic_subscribers(post):
    """
    This is the built-in djangobb_forum method of notifying for subscriptions.
    """
    topic = post.topic
    post_body_text = strip_tags(post.body_html)
    if post != topic.head:
        subject = u'RE: %s' % topic.name
        to_email = user.email
        text_content = TOPIC_SUBSCRIPTION_TEXT_TEMPLATE % {
                'username': post.user.username,
                'message': post_body_text,
                'post_url': absolute_url(post.get_absolute_url()),
                'unsubscribe_url': absolute_url(reverse('djangobb:forum_delete_subscription', args=[post.topic.id])),
            }
        #html_content = html_version(post)
        send_mail(subject, text_content, settings.DEFAULT_FROM_EMAIL, [to_email])


@task 
def scratch_notify_topic_subscribers(post_id):
    """
    Scratch task for notifying subscribers to a topic that someone has made a
    new post.
    """
    post = Post.objects.select_related('topic').get(pk=post_id)
    topic = post.topic
    if post != topic.head:
        social_action = SocialAction(
            actor = post.user,
            object = topic,
        )
        social_action.save()
        # save() adds recipients and sends out notifications
