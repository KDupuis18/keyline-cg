/* Test double for the NDI runtime: same exported symbols and struct layout as NDI SDK 5/6.
   Records every frame's metadata and dumps the last frame (raw BGRA) for inspection. */
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct { const char* p_ndi_name; const char* p_groups; bool clock_video; bool clock_audio; } NDIlib_send_create_t;
typedef struct {
  int xres, yres; int FourCC; int frame_rate_N, frame_rate_D; float picture_aspect_ratio; int frame_format_type;
  int64_t timecode; uint8_t* p_data; union { int line_stride_in_bytes; int data_size_in_bytes; }; const char* p_metadata; int64_t timestamp;
} NDIlib_video_frame_v2_t;
static char g_name[256]; static long g_frames = 0;
bool NDIlib_initialize(void) { return true; }
void* NDIlib_send_create(const NDIlib_send_create_t* p) { snprintf(g_name, sizeof g_name, "%s", p && p->p_ndi_name ? p->p_ndi_name : "(null)"); return (void*)0x1234; }
int NDIlib_send_get_no_connections(void* inst, uint32_t t) { return 2; }
void NDIlib_send_send_video_v2(void* inst, const NDIlib_video_frame_v2_t* f) {
  g_frames++;
  const char* out = getenv("FAKE_NDI_OUT"); if (!out) return;
  long opaque = 0, partial = 0; size_t n = (size_t)f->xres * f->yres;
  for (size_t i = 0; i < n; i++) { uint8_t a = f->p_data[i * 4 + 3]; if (a == 255) opaque++; else if (a) partial++; }
  FILE* fp = fopen(out, "w");
  if (fp) { fprintf(fp, "{\"name\":\"%s\",\"frames\":%ld,\"xres\":%d,\"yres\":%d,\"fourcc\":%d,\"N\":%d,\"D\":%d,\"aspect\":%.4f,\"format\":%d,\"stride\":%d,\"tc_synth\":%s,\"opaque\":%ld,\"partial\":%ld,\"inst\":%s}\n",
      g_name, g_frames, f->xres, f->yres, f->FourCC, f->frame_rate_N, f->frame_rate_D, f->picture_aspect_ratio, f->frame_format_type, f->line_stride_in_bytes,
      f->timecode == INT64_MAX ? "true" : "false", opaque, partial, inst == (void*)0x1234 ? "true" : "false"); fclose(fp); }
  char raw[600]; snprintf(raw, sizeof raw, "%s.bgra", out);
  fp = fopen(raw, "wb"); if (fp) { fwrite(f->p_data, 1, (size_t)f->line_stride_in_bytes * f->yres, fp); fclose(fp); }
}
void NDIlib_send_destroy(void* inst) {}
void NDIlib_destroy(void) {}
