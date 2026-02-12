#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/Xutil.h>
#include <X11/extensions/XTest.h>
#include <X11/keysym.h>
#include <unistd.h>

static const char *terminal_classes[] = {
    "konsole", "gnome-terminal", "terminal", "kitty", "alacritty",
    "terminator", "xterm", "urxvt", "rxvt", "tilix", "terminology",
    "wezterm", "foot", "st", "yakuake", "ghostty", "guake", "tilda",
    "hyper", "tabby", "sakura", "warp", NULL
};

static int is_terminal(const char *wm_class) {
    if (!wm_class) return 0;
    for (int i = 0; terminal_classes[i]; i++) {
        if (strcasestr(wm_class, terminal_classes[i]))
            return 1;
    }
    return 0;
}

static Window get_active_window(Display *dpy) {
    Atom prop = XInternAtom(dpy, "_NET_ACTIVE_WINDOW", True);
    if (prop != None) {
        Atom actual_type;
        int actual_format;
        unsigned long nitems, bytes_after;
        unsigned char *data = NULL;

        if (XGetWindowProperty(dpy, DefaultRootWindow(dpy), prop, 0, 1, False,
                               XA_WINDOW, &actual_type, &actual_format,
                               &nitems, &bytes_after, &data) == Success && data) {
            Window win = nitems > 0 ? *(Window *)data : None;
            XFree(data);
            if (win != None) return win;
        }
    }

    Window focused;
    int revert;
    XGetInputFocus(dpy, &focused, &revert);
    return focused;
}

/* Send _NET_ACTIVE_WINDOW client message then fall back to XSetInputFocus */
static void activate_window(Display *dpy, Window win) {
    Atom net_active = XInternAtom(dpy, "_NET_ACTIVE_WINDOW", False);
    XEvent ev;
    memset(&ev, 0, sizeof(ev));
    ev.xclient.type         = ClientMessage;
    ev.xclient.window       = win;
    ev.xclient.message_type = net_active;
    ev.xclient.format       = 32;
    ev.xclient.data.l[0]    = 2; /* source: pager / direct call */
    ev.xclient.data.l[1]    = CurrentTime;
    ev.xclient.data.l[2]    = 0;

    XSendEvent(dpy, DefaultRootWindow(dpy), False,
               SubstructureNotifyMask | SubstructureRedirectMask, &ev);
    XFlush(dpy);

    /* Give the WM time to process the activation request */
    usleep(50000);

    /* Fallback: also set X input focus directly */
    XSetInputFocus(dpy, win, RevertToParent, CurrentTime);
    XFlush(dpy);
    usleep(20000);
}

int main(int argc, char *argv[]) {
    int force_terminal = 0;
    Window target_window = None;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--terminal") == 0) {
            force_terminal = 1;
        } else if (strcmp(argv[i], "--window") == 0 && i + 1 < argc) {
            target_window = (Window)strtoul(argv[++i], NULL, 0);
        }
    }

    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) return 1;

    int event_base, error_base, major, minor;
    if (!XTestQueryExtension(dpy, &event_base, &error_base, &major, &minor)) {
        XCloseDisplay(dpy);
        return 2;
    }

    /* If a target window was supplied, activate it so it receives the keystrokes */
    if (target_window != None) {
        activate_window(dpy, target_window);
    }

    Window win = (target_window != None) ? target_window : get_active_window(dpy);

    int use_shift = force_terminal;
    if (!use_shift && win != None) {
        XClassHint hint;
        if (XGetClassHint(dpy, win, &hint)) {
            use_shift = is_terminal(hint.res_class) || is_terminal(hint.res_name);
            XFree(hint.res_name);
            XFree(hint.res_class);
        }
    }

    KeyCode ctrl = XKeysymToKeycode(dpy, XK_Control_L);
    KeyCode shift = XKeysymToKeycode(dpy, XK_Shift_L);
    KeyCode v = XKeysymToKeycode(dpy, XK_v);

    XTestFakeKeyEvent(dpy, ctrl, True, CurrentTime);
    if (use_shift)
        XTestFakeKeyEvent(dpy, shift, True, CurrentTime);
    usleep(8000);

    XTestFakeKeyEvent(dpy, v, True, CurrentTime);
    usleep(8000);
    XTestFakeKeyEvent(dpy, v, False, CurrentTime);

    usleep(8000);
    if (use_shift)
        XTestFakeKeyEvent(dpy, shift, False, CurrentTime);
    XTestFakeKeyEvent(dpy, ctrl, False, CurrentTime);

    XFlush(dpy);
    usleep(20000);
    XCloseDisplay(dpy);
    return 0;
}
