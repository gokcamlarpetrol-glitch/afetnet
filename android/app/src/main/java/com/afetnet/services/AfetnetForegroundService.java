package com.afetnet.services;
import android.app.*;
import android.content.*;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class AfetnetForegroundService extends Service {
  public static final int ID = 1011;
  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    Notification n = new NotificationCompat.Builder(this, "afetnet")
      .setContentTitle("Afetnet")
      .setContentText("Yakın cihazlarla afet ağı çalışıyor")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true).build();
    startForeground(ID, n);
    return START_STICKY;
  }
  @Override public IBinder onBind(Intent intent){ return null; }
}
