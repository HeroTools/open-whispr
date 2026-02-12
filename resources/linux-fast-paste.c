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
    "wezterm", "foot", "st", "yakuake", NULL
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

int main(int argc, char *argv[]) {
    int force_terminal = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--terminal") == 0)
            force_terminal = 1;
    }

    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) return 1;

    int event_base, error_base, major, minor;
    if (!XTestQueryExtension(dpy, &event_base, &error_base, &major, &minor)) {
        XCloseDisplay(dpy);
        return 2;
    }

    int use_shift = force_terminal;
    if (!use_shift) {
        Window win = get_active_window(dpy);
        if (win != None) {
            XClassHint hint;
            if (XGetClassHint(dpy, win, &hint)) {
                use_shift = is_terminal(hint.res_class) || is_terminal(hint.res_name);
                XFree(hint.res_name);
                XFree(hint.res_class);
            }
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
